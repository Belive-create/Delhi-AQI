const express = require("express");
const https = require("https");
const path = require("path");

const app = express();
const PORT = 5000;

/* =========================
   API KEY
========================= */

const API_KEY = "9937d49d160b63eeb95ba143c8973684";

/* =========================
   CACHE
========================= */

let aqiCache = {};
const CACHE_DURATION = 5 * 60 * 1000;

/* =========================
   INDIA LOCATIONS
========================= */

const INDIA_LOCATIONS = [

  // DELHI
  { city: "Delhi", name: "Connaught Place", lat: 28.6328, lon: 77.2197 },
  { city: "Delhi", name: "India Gate", lat: 28.6129, lon: 77.2295 },
  { city: "Delhi", name: "Rohini", lat: 28.7032, lon: 77.1010 },

  // MUMBAI
  { city: "Mumbai", name: "Bandra", lat: 19.0596, lon: 72.8295 },
  { city: "Mumbai", name: "Andheri", lat: 19.1136, lon: 72.8697 },
  { city: "Mumbai", name: "Colaba", lat: 18.9067, lon: 72.8147 },

  // BENGALURU
  { city: "Bengaluru", name: "Whitefield", lat: 12.9698, lon: 77.7500 },
  { city: "Bengaluru", name: "Electronic City", lat: 12.8399, lon: 77.6770 },

  // CHENNAI
  { city: "Chennai", name: "T Nagar", lat: 13.0418, lon: 80.2341 },
  { city: "Chennai", name: "Velachery", lat: 12.9791, lon: 80.2209 },

  // KOLKATA
  { city: "Kolkata", name: "Salt Lake", lat: 22.5867, lon: 88.4170 },

  // HYDERABAD
  { city: "Hyderabad", name: "Gachibowli", lat: 17.4401, lon: 78.3489 },

  // PUNE
  { city: "Pune", name: "Hinjewadi", lat: 18.5912, lon: 73.7389 },

  // JAIPUR
  { city: "Jaipur", name: "Malviya Nagar", lat: 26.8467, lon: 75.8056 },

  // LUCKNOW
  { city: "Lucknow", name: "Gomti Nagar", lat: 26.8480, lon: 81.0080 },

  // CHANDIGARH
  { city: "Chandigarh", name: "Sector 17", lat: 30.7415, lon: 76.7681 },

  // AHMEDABAD
  { city: "Ahmedabad", name: "Navrangpura", lat: 23.0375, lon: 72.5619 },

  // SURAT
  { city: "Surat", name: "Adajan", lat: 21.1702, lon: 72.8311 },

  // PATNA
  { city: "Patna", name: "Kankarbagh", lat: 25.5941, lon: 85.1376 },

  // BHOPAL
  { city: "Bhopal", name: "MP Nagar", lat: 23.2599, lon: 77.4126 },

  // NOIDA
  { city: "Noida", name: "Sector 62", lat: 28.6280, lon: 77.3649 },

  // GHAZIABAD
  { city: "Ghaziabad", name: "Indirapuram", lat: 28.6460, lon: 77.3695 }
];

/* =========================
   AQI FUNCTIONS
========================= */

function linear(C, Clow, Chigh, Ilow, Ihigh) {
  return Math.round(
    ((Ihigh - Ilow) / (Chigh - Clow)) * (C - Clow) + Ilow
  );
}

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

/* =========================
   FETCH AQI
========================= */

const fetchAreaAQI = (area) =>
  new Promise((resolve) => {

    const cacheKey = `${area.city}-${area.name}`;

    if (
      aqiCache[cacheKey] &&
      Date.now() - aqiCache[cacheKey].timestamp < CACHE_DURATION
    ) {
      return resolve(aqiCache[cacheKey].data);
    }

    const url =
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${area.lat}&lon=${area.lon}&appid=${API_KEY}`;

    https.get(url, (apiRes) => {

      let data = "";

      apiRes.on("data", chunk => data += chunk);

      apiRes.on("end", () => {

        try {

          const json = JSON.parse(data);

          if (!json.list || !json.list.length) {
            return resolve(null);
          }

          const mainData = json.list[0];

          const pm25 = mainData.components.pm2_5;
          const pm10 = mainData.components.pm10;

          const aqi = Math.max(
            calcAQI_PM25(pm25),
            calcAQI_PM10(pm10)
          );

          const result = {
            city: area.city,
            location: area.name,
            lat: area.lat,
            lon: area.lon,
            AQI: aqi,
            pm25,
            pm10,
            lastUpdated: new Date().toISOString()
          };

          aqiCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
          };

          resolve(result);

        } catch (err) {
  console.log(err);
  resolve(null);
}

      });

    }).on("error", () => resolve(null));

  });

/* =========================
   API
========================= */

app.get("/api/aqi", async (req, res) => {

  try {

    const cityQuery = req.query.city;

    let locations = INDIA_LOCATIONS;

    if (cityQuery) {
      locations = INDIA_LOCATIONS.filter(
        l => l.city.toLowerCase() === cityQuery.toLowerCase()
      );
    }

    const stations = (
      await Promise.all(locations.map(fetchAreaAQI))
    ).filter(Boolean);

    const avgAQI = Math.round(
      stations.reduce((sum, s) => sum + s.AQI, 0) / stations.length
    );

    res.json({
      totalStations: stations.length,
      averageAQI: avgAQI,
      stations
    });

  } catch (err) {

    res.status(500).json({
      error: "Failed to fetch AQI"
    });

  }

});

/* =========================
   FRONTEND
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "server.html"));
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
