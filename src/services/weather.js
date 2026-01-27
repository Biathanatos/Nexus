import { fetchWeatherApi } from "https://esm.sh/openmeteo";

export async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  root.innerHTML = `
    <form id="weather-form">
      <label for="city-input">Ville :</label>
      <input type="text" id="city-input" name="city" placeholder="Liège" required />
      <button type="submit" id="submit-btn">Voir la météo</button>
    </form>

    <div id="weather-summary"></div>

    <table id="weather-table" border="1">
      <thead>
        <tr>
          <th>Date et heure</th>
          <th>T° (°C)</th>
          <th>Ressenti (°C)</th>
          <th>Humidité (%)</th>
          <th>Pluie (mm)</th>
          <th>Vent (km/h)</th>
          <th>Nuages (%)</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
}

// point d'entrée
export async function start(userInput) {
  await main(userInput[0]);
}

async function main(city) {
  const summary = document.getElementById("weather-summary");
  const tbody = document.querySelector("#weather-table tbody");

  if (!summary || !tbody) {
    // si quelqu’un appelle start() sans ui()
    await ui();
    return main(city);
  }

  summary.textContent = "Chargement…";
  tbody.innerHTML = "";

  // 1) geocoding
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) {
    summary.innerHTML = `Impossible de géocoder <strong>${city}</strong> (code ${geoRes.status}).`;
    return;
  }

  const geo = await geoRes.json();
  if (!geo.results?.length) {
    summary.innerHTML = `Ville <strong>${city}</strong> non trouvée.`;
    return;
  }

  const { latitude, longitude, name, country } = geo.results[0];

  // 2) météo
  const params = {
    latitude,
    longitude,
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "relativehumidity_2m",
      "rain",
      "windspeed_10m",
      "cloudcover",
    ],
  };

  const responses = await fetchWeatherApi("https://api.open-meteo.com/v1/forecast", params);
  const response = responses[0];

  const utcOffsetSeconds = response.utcOffsetSeconds();
  const hourly = response.hourly();

  const count =
    (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval();

  const time = Array.from({ length: count }, (_, i) =>
    new Date((Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000)
  );

  const temperature = hourly.variables(0).valuesArray();
  const feels = hourly.variables(1).valuesArray();
  const humidity = hourly.variables(2).valuesArray();
  const rain = hourly.variables(3).valuesArray();
  const wind = hourly.variables(4).valuesArray();
  const clouds = hourly.variables(5).valuesArray();

  // résumé simple (première heure)
  summary.innerHTML = `<h3>Météo pour ${name}${country ? `, ${country}` : ""}</h3>
    <p>La température d'aujourd'hui est de ${Math.floor(temperature[0])}°C avec un ressenti de ${Math.floor(feels[0])}°C et une humidité à ${humidity[0]}%.</p>`;

  // table
  for (let i = 0; i < time.length; i++) {
    const tr = document.createElement("tr");
    const cells = [
      time[i].toLocaleString(),
      Math.floor(temperature[i]),
      Math.floor(feels[i]),
      Math.floor(humidity[i]),
      Math.floor(rain[i]),
      Math.floor(wind[i]),
      Math.floor(clouds[i]),
    ];
    for (const v of cells) {
      const td = document.createElement("td");
      td.textContent = String(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// Pont vers le monde "non-module"
globalThis.ui = ui;
globalThis.start = start;