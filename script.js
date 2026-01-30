const express = require("express");
const https = require("https");
const path = require("path");
const app = express();
const PORT = 5000;
const host = "0.0.0.0";

const API_KEY = "9937d49d160b63eeb95ba143c8973684"; 

function calcAQI_PM25(pm) {
  if (pm <= 12) return linear(pm, 0, 12, 0, 50);
  if (pm <= 35.4) return linear(pm, 12.1, 35.4, 51, 100);
  if (pm <= 55.4) return linear(pm, 35.5, 55.4, 101, 150);
  if (pm <= 150.4) return linear(pm, 55.5, 150.4, 151, 200);
  if (pm <= 250.4) return linear(pm, 150.5, 250.4, 201, 300);
  return linear(pm, 250.5, 500, 301, 500);
}

function calcAQI_PM10(pm) {
  if (pm <= 54) return linear(pm, 0, 54, 0, 50);
  if (pm <= 154) return linear(pm, 55, 154, 51, 100);
  if (pm <= 254) return linear(pm, 155, 254, 101, 150);
  if (pm <= 354) return linear(pm, 255, 354, 151, 200);
  if (pm <= 424) return linear(pm, 355, 424, 201, 300);
  return linear(pm, 425, 604, 301, 500);
}

function linear(C, Clow, Chigh, Ilow, Ihigh) {
  return Math.round(
    ((Ihigh - Ilow) / (Chigh - Clow)) * (C - Clow) + Ilow
  );
}

app.get("/api/aqi", async (req, res) => {
  try {
    const areas = [
      { name: "Connaught Place", lat: 28.6328, lon: 77.2197 },
      { name: "Karol Bagh", lat: 28.6465, lon: 77.2075 },
      { name: "Dwarka", lat: 28.5786, lon: 77.0421 },
      { name: "Rohini", lat: 28.7032, lon: 77.1010 },
      { name: "Lajpat Nagar", lat: 28.5673, lon: 77.2390 },
      { name: "Janakpuri", lat: 28.6185, lon: 77.0902 },
      { name: "Vasant Kunj", lat: 28.5242, lon: 77.1667 }
    ];

//       const areas = [
//   { name: "Delhi",         lat: 28.6139, lon: 77.2090 },
//   { name: "Mumbai",        lat: 19.0760, lon: 72.8777 },
//   { name: "Kolkata",       lat: 22.5726, lon: 88.3639 },
//   { name: "Chennai",       lat: 13.0827, lon: 80.2707 },
//   { name: "Bengaluru",     lat: 12.9716, lon: 77.5946 },
//   { name: "Jaipur",        lat: 26.9124, lon: 75.7873 },
//   { name: "Guwahati",      lat: 26.1445, lon: 91.7362 },
//   { name: "London",        lat: 51.5074, lon: -0.1278 }
// ];

   // const AQI_map = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 300 };

   const fetchAreaAQI = (area) =>
  new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${area.lat}&lon=${area.lon}&appid=${API_KEY}`;

    https.get(url, (apiRes) => {
      let data = "";

      apiRes.on("data", chunk => data += chunk);

      apiRes.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (!json.list || json.list.length === 0) {
            return resolve(null);
          }

          const mainData = json.list[0];

          const pm25 = mainData.components.pm2_5;
          const pm10 = mainData.components.pm10;

          const aqiPM25 = calcAQI_PM25(pm25);
          const aqiPM10 = calcAQI_PM10(pm10);

          // Final AQI = worst pollutant
          const realAQI = Math.max(aqiPM25, aqiPM10);

          resolve({
            location: area.name,
            lat: area.lat, // <--- ADDED: Passes latitude to frontend
            lon: area.lon, // <--- ADDED: Passes longitude to frontend
            AQI: realAQI,
            pm25,
            pm10,
            lastUpdated: new Date(mainData.dt * 1000).toISOString()
          });

        } catch (e) {
          resolve(null);
          console.log("error",e);
        }
      });

    }).on("error", err => reject(err));
  });

    const stations = (await Promise.all(areas.map(fetchAreaAQI))).filter(Boolean);

    res.json({ city: "Delhi", stations });
  } catch (err) {
    console.error(err);
    res.json({ city: "Delhi", stations: [] });
  }
});

app.use((req, res, next) => {
  console.log(req.method, req.url + "\t" + req.ip);
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, './server.html'));
});

app.listen(PORT, host, () => {
  console.log("Server running at http://localhost:" + PORT);
});