import React from "react";
import api from "../services/api";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleQuantize } from "d3-scale";

// GeoJSON externo (tem properties.name, ex: "Amazonas")
const geoUrl =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

// Mapa de nome -> sigla (para casar com sg_uf do backend/mock)
const NAME_TO_UF = {
  "Acre": "AC",
  "Alagoas": "AL",
  "Amapá": "AP",
  "Amazonas": "AM",
  "Bahia": "BA",
  "Ceará": "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  "Goiás": "GO",
  "Maranhão": "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  "Pará": "PA",
  "Paraíba": "PB",
  "Paraná": "PR",
  "Pernambuco": "PE",
  "Piauí": "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  "Rondônia": "RO",
  "Roraima": "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  "Sergipe": "SE",
  "Tocantins": "TO"
};

export default function Maps() {
  const [byUF, setByUF] = React.useState({}); // { AM: 123, ... }

  React.useEffect(() => {
    (async () => {
      const { data } = await api.get("/matriculas_por_uf");
      const map = {};
      data.forEach((x) => (map[x.sg_uf] = Number(x.total) || 0));
      setByUF(map);
    })().catch(console.error);
  }, []);

  const values = Object.values(byUF);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  const color = scaleQuantize()
    .domain([min, max])
    .range([
      "#e1f5fe",
      "#b3e5fc",
      "#81d4fa",
      "#4fc3f7",
      "#29b6f6",
      "#03a9f4",
      "#039be5",
      "#0288d1",
      "#01579b",
    ]);

  return (
    <div className="content">
      <div className="card">
        <div className="card-header">
          <h4 className="card-title">Matrículas por UF</h4>
        </div>

        {/* wrapper centralizado e com altura fixa */}
        <div
          className="card-body"
          style={{
            height: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              // centraliza no Brasil (lon, lat)
              center: [-55, -15],
              scale: 800, // ajuste fino do zoom
            }}
            style={{ width: "90%", height: "90%" }} // ocupa bem o card
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name = geo.properties.name; // vem do click_that_hood
                  const uf = NAME_TO_UF[name] || name; // mapeia para sigla
                  const v = byUF[uf] || 0;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={values.length ? color(v) : "#EEE"}
                      stroke="#999"
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", opacity: 0.85 },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      </div>
    </div>
  );
}
