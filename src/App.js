import React, { useState, useRef } from "react";
import "./App.css";

function format(val, units) {
  return val !== undefined && val !== null && val !== "" ? `${val}${units || ""}` : "—";
}

// AQI category and US EPA PM2.5 breakpoints
function AQI({ pm2_5 }) {
  if (pm2_5 === undefined || pm2_5 === null || isNaN(pm2_5)) return "—";
  const breakpoints = [
    { AQIh: 50,   Cl: 0.0,    Ch: 12.0,   category: "Good" },
    { AQIh: 100,  Cl: 12.1,   Ch: 35.4,   category: "Moderate" },
    { AQIh: 150,  Cl: 35.5,   Ch: 55.4,   category: "Unhealthy for Sensitive" },
    { AQIh: 200,  Cl: 55.5,   Ch: 150.4,  category: "Unhealthy" },
    { AQIh: 300,  Cl: 150.5,  Ch: 250.4,  category: "Very Unhealthy" },
    { AQIh: 400,  Cl: 250.5,  Ch: 350.4,  category: "Hazardous" },
    { AQIh: 500,  Cl: 350.5,  Ch: 500.4,  category: "Extremely Hazardous" }
  ];
  let aqi = 0, cat = "";
  for (const bp of breakpoints) {
    if (pm2_5 >= bp.Cl && pm2_5 <= bp.Ch) {
      // Linear interpolation for US AQI
      const AQIl = (breakpoints[breakpoints.indexOf(bp) - 1]?.AQIh || 0);
      const Cl = bp.Cl, Ch = bp.Ch, AQIh = bp.AQIh;
      aqi = Math.round(
        ((AQIh - AQIl) / (Ch - Cl)) * (pm2_5 - Cl) + AQIl
      );
      cat = bp.category;
      break;
    }
  }
  if (aqi === 0) return "—";
  return (
    <span style={{ fontWeight: "bold", color:
      aqi <= 50 ? "#227d34" : aqi <= 100 ? "#edc13b" : aqi <= 150 ? "#ea7417"
        : aqi <= 200 ? "#c81b19" : aqi <= 300 ? "#7e179a" : "#5a2210"
    }}>
      {aqi} ({cat})
    </span>
  );
}

export default function App() {
  const [lat, setLat] = useState("28.61");
  const [lon, setLon] = useState("77.23");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const debounceRef = useRef();

  function debouncedFetch(val) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(val) + "&addressdetails=1&limit=5")
        .then(r => r.json())
        .then(data => setSuggestions(data || []))
        .catch(() => setSuggestions([]));
    }, 300);
  }

  async function getWeatherData() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      // Weather and UV index
      const urlWeather = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,uv_index`;
      const resWeather = await fetch(urlWeather);
      if (!resWeather.ok) throw new Error("Failed weather fetch");
      const weatherData = await resWeather.json();

      // AQI
      const urlAQI = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;
      const resAQI = await fetch(urlAQI);
      let aqiData = null;
      if (resAQI.ok) {
        const json = await resAQI.json();
        let idx = 0;
        if (json.hourly && json.hourly.time && json.hourly.time.length) {
          idx = json.hourly.time.length - 1;
        }
        aqiData = json.hourly
          ? {
              pm2_5: json.hourly.pm2_5 ? json.hourly.pm2_5[idx] : undefined,
              pm10: json.hourly.pm10 ? json.hourly.pm10[idx] : undefined,
              carbon_monoxide: json.hourly.carbon_monoxide
                ? json.hourly.carbon_monoxide[idx]
                : undefined,
              nitrogen_dioxide: json.hourly.nitrogen_dioxide
                ? json.hourly.nitrogen_dioxide[idx]
                : undefined,
              sulphur_dioxide: json.hourly.sulphur_dioxide
                ? json.hourly.sulphur_dioxide[idx]
                : undefined,
              ozone: json.hourly.ozone ? json.hourly.ozone[idx] : undefined,
            }
          : null;
      }
      setResult({
        weather: weatherData.current,
        aqi: aqiData
      });
    } catch (err) {
      setErr(err.message);
    }
    setLoading(false);
  }

  // To use a custom background, save the image as `public/background.jpg`
  // in your project and the app will use it automatically.
  const appBg = {
    maxWidth: 520,
    margin: "2rem auto",
    padding: "1.5rem",
    fontFamily: "sans-serif",
    background: "#eef",
    backgroundImage: "url('/background.jpg')",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundPosition: "center center",
    borderRadius: 12
  };

  return (
      <div className="App" style={appBg}>
        <h2>SunSafe</h2>
        <div style={{ fontSize: "1.22em", fontWeight: 400, marginBottom: 16 }}>
          Stay safe under the sun and breathe better with real-time UV, air quality, and weather insights at your fingertips.
        </div>
        <div style={{ position: "relative", marginBottom: "1em" }}>
          <input
            type="text"
            placeholder="Search for a place..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.length >= 3) debouncedFetch(e.target.value);
              else setSuggestions([]);
            }}
            style={{ width: 260, padding: "6px" }}
          />
          {suggestions.length > 0 && (
            <ul style={{
              position: "absolute", top: 36, left: 0, zIndex: 999, background: "#fff",
              border: "1px solid #ccc", width: 260, maxHeight: 180, overflowY: "auto",
              padding: 0, margin: 0, listStyle: "none" }}>
              {suggestions.map((s) => (
                <li
                  key={s.place_id}
                  onClick={() => {
                    setSearch(s.display_name);
                    setLat(s.lat);
                    setLon(s.lon);
                    setSuggestions([]);
                  }}
                  style={{ padding: "6px 8px", cursor: "pointer" }}
                >
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ marginBottom: "1em" }}>
          <label>
            Latitude:{" "}
            <input type="text" value={lat} onChange={e => setLat(e.target.value)} style={{ width: 100 }} />
          </label>
          <label style={{ marginLeft: "1em" }}>
            Longitude:{" "}
            <input type="text" value={lon} onChange={e => setLon(e.target.value)} style={{ width: 100 }} />
          </label>
        </div>
        <button onClick={getWeatherData} style={{ marginBottom: "1em" }}>Get Data</button>
        {loading && <div style={{ color: "#555" }}>Loading...</div>}
        {err && <div style={{ color: "red" }}>Error: {err}</div>}
        {result && (
          <div style={{ background: "#fff", padding: "1em", borderRadius: 8, marginTop: "1em" }}>
            <div><b>Temperature:</b> {format(result.weather?.temperature_2m, " °C")}</div>
            <div><b>Humidity:</b> {format(result.weather?.relative_humidity_2m, " %")}</div>
            <div><b>UV Index:</b> {format(result.weather?.uv_index)}</div>
            <hr />
            <div style={{margin: "10px 0", fontWeight: "bold"}}>Air Quality Index (PM2.5): <AQI pm2_5={result.aqi?.pm2_5} /></div>
            <div><b>AQI / Pollutants:</b></div>
            <div>PM2.5: {format(result.aqi?.pm2_5, " µg/m³")}</div>
            <div>PM10: {format(result.aqi?.pm10, " µg/m³")}</div>
            <div>CO: {format(result.aqi?.carbon_monoxide, " µg/m³")}</div>
            <div>NO₂: {format(result.aqi?.nitrogen_dioxide, " µg/m³")}</div>
            <div>SO₂: {format(result.aqi?.sulphur_dioxide, " µg/m³")}</div>
            <div>O₃: {format(result.aqi?.ozone, " µg/m³")}</div>
          </div>
        )}
        <div style={{marginTop: "2.5em", textAlign:"right", color:"#888"}}>© Tapas Khandual</div>
      </div>
    );
  }
