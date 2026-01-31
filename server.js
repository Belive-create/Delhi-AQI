const express = require("express");
const https = require("https");
const path = require("path");
const app = express();
const PORT = 5000;

const API_KEY = "9937d49d160b63eeb95ba143c8973684"; 

// --- CACHE & LOCATIONS ---
let aqiCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 Minutes

// Full List of 30+ Delhi Locations
const DELHI_LOCATIONS = [
  { name: "Connaught Place", lat: 28.6328, lon: 77.2197 },
  { name: "India Gate", lat: 28.6129, lon: 77.2295 },
  { name: "Karol Bagh", lat: 28.6465, lon: 77.2075 },
  { name: "Chandni Chowk", lat: 28.6506, lon: 77.2303 },
  { name: "Dwarka", lat: 28.5786, lon: 77.0421 },
  { name: "Rohini", lat: 28.7032, lon: 77.1010 },
  { name: "Pitampura", lat: 28.6990, lon: 77.1384 },
  { name: "Punjabi Bagh", lat: 28.6616, lon: 77.1264 },
  { name: "Janakpuri", lat: 28.6185, lon: 77.0902 },
  { name: "Mundka", lat: 28.6814, lon: 77.0267 },
  { name: "Najafgarh", lat: 28.6090, lon: 76.9855 },
  { name: "Lajpat Nagar", lat: 28.5673, lon: 77.2390 },
  { name: "Hauz Khas", lat: 28.5494, lon: 77.2001 },
  { name: "Vasant Kunj", lat: 28.5242, lon: 77.1667 },
  { name: "Saket", lat: 28.5244, lon: 77.2132 },
  { name: "Mehrauli", lat: 28.5126, lon: 77.1764 },
  { name: "Okhla Phase I", lat: 28.5299, lon: 77.2755 },
  { name: "Nehru Place", lat: 28.5492, lon: 77.2530 },
  { name: "Sarita Vihar", lat: 28.5262, lon: 77.2882 },
  { name: "Mayur Vihar", lat: 28.6087, lon: 77.2996 },
  { name: "Anand Vihar", lat: 28.6469, lon: 77.3160 },
  { name: "Shahdara", lat: 28.6983, lon: 77.2815 },
  { name: "Sonia Vihar", lat: 28.7095, lon: 77.2580 },
  { name: "Narela", lat: 28.8427, lon: 77.0964 },
  { name: "Bawana", lat: 28.8162, lon: 77.0458 },
  { name: "Alipur", lat: 28.7981, lon: 77.1328 },
  { name: "Jahangirpuri", lat: 28.7259, lon: 77.1627 },
  { name: "Burari", lat: 28.7523, lon: 77.1995 },
  { name: "Lodhi Road", lat: 28.5884, lon: 77.2217 },
  { name: "Pusa", lat: 28.6340, lon: 77.1528 }
];

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
  return Math.round(((Ihigh - Ilow) / (Chigh - Clow)) * (C - Clow) + Ilow);
}

const fetchAreaAQI = (area) =>
  new Promise((resolve) => {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${area.lat}&lon=${area.lon}&appid=${API_KEY}`;
    https.get(url, (apiRes) => {
      let data = "";
      apiRes.on("data", chunk => data += chunk);
      apiRes.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.list || json.list.length === 0) return resolve(null);
          const mainData = json.list[0];
          const pm25 = mainData.components.pm2_5;
          const pm10 = mainData.components.pm10;
          const aqi = Math.max(calcAQI_PM25(pm25), calcAQI_PM10(pm10));
          
          resolve({
            location: area.name,
            lat: area.lat,
            lon: area.lon,
            AQI: aqi,
            pm25,
            pm10,
            lastUpdated: new Date().toISOString()
          });
        } catch (e) { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });

app.get("/api/aqi", async (req, res) => {
  try {
    if (aqiCache.data && (Date.now() - aqiCache.timestamp < CACHE_DURATION)) {
      return res.json(aqiCache.data);
    }
    const stations = (await Promise.all(DELHI_LOCATIONS.map(fetchAreaAQI))).filter(Boolean);
    const responseData = { city: "Delhi", stations };
    aqiCache.data = responseData;
    aqiCache.timestamp = Date.now();
    res.json(responseData);
  } catch (err) {
    res.json({ city: "Delhi", stations: [] });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), 'serv.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log("Server running on port " + PORT));
}

module.exports = app;
