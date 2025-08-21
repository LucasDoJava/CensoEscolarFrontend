
import React from "react";
import api from "../services/api";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { scaleQuantize } from "d3-scale";
import { geoCentroid } from "d3-geo";

const geoUrl =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const NAME_TO_UF = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

const BR_CENTER = [-55, -15];

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}


function animateCenterZoom({
  startCenter,
  endCenter,
  startZoom,
  endZoom,
  duration = 900,
  overshoot = 0.06,
  onUpdate,
  onDone,
  setCancelRef,
}) {
  const start = performance.now();
  const [sx, sy] = startCenter;
  const [ex, ey] = endCenter;
  const dz = endZoom - startZoom;

  let rafId = null;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const te = easeInOutCubic(t);
    const over = te + overshoot * Math.sin(Math.PI * te);
    onUpdate([sx + (ex - sx) * over, sy + (ey - sy) * over], startZoom + dz * over);
    if (t < 1) rafId = requestAnimationFrame(tick);
    else {
      onUpdate(endCenter, endZoom);
      onDone && onDone();
    }
  };
  rafId = requestAnimationFrame(tick);
  setCancelRef && setCancelRef(() => cancelAnimationFrame(rafId));
}

function labelShift(uf) {
  switch (uf) {
    case "DF":
      return [0.6, -0.3];
    case "ES":
      return [0.6, 0.1];
    case "RJ":
      return [0.5, 0.25];
    case "SE":
      return [0.35, 0.15];
    default:
      return [0, 0];
  }
}

export default function Maps() {
  const [ano, setAno] = React.useState("2024");
  const [byUF, setByUF] = React.useState({});
  const [center, setCenter] = React.useState(BR_CENTER);
  const [zoom, setZoom] = React.useState(1);
  const [selectedUF, setSelectedUF] = React.useState(null);
  const [animating, setAnimating] = React.useState(false);
  const cancelAnimRef = React.useRef(null);

  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const { data } = await api.get(`/matriculas/uf/${ano}`, { signal: ac.signal });
        const list = Array.isArray(data?.dados)
          ? data.dados
          : Array.isArray(data)
          ? data
          : [];
        const map = {};
        for (const r of list) {
          const uf = r.uf || r.sigla;
          const tot = Number(r.total_matriculas ?? r.total ?? r.matriculas ?? 0);
          if (uf) map[uf] = tot;
        }
        setByUF(map);
      } catch (e) {
        if (e.name !== "CanceledError" && e.name !== "AbortError") {
          console.error("Erro ao carregar matrículas por UF", e);
          setByUF({});
        }
      }
    })();
    return () => ac.abort();
  }, [ano]);

  const values = Object.values(byUF);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  const color = scaleQuantize()
    .domain([min, Math.max(max, 1)])
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

  const focusZoom = 4;

  const handleClick = (geo) => {
    if (animating) return;
    const name = geo.properties.name;
    const uf = NAME_TO_UF[name] || name;
    const [cx, cy] = geoCentroid(geo);
    setSelectedUF(uf);
    setAnimating(true);
    animateCenterZoom({
      startCenter: center,
      endCenter: [cx, cy],
      startZoom: zoom,
      endZoom: focusZoom,
      duration: 900,
      overshoot: 0.08,
      onUpdate: (c, z) => {
        setCenter(c);
        setZoom(z);
      },
      onDone: () => setAnimating(false),
      setCancelRef: (fn) => (cancelAnimRef.current = fn),
    });
  };

  const resetFocus = () => {
    if (animating) return;
    setAnimating(true);
    setSelectedUF(null);
    animateCenterZoom({
      startCenter: center,
      endCenter: BR_CENTER,
      startZoom: zoom,
      endZoom: 1,
      duration: 700,
      overshoot: 0.05,
      onUpdate: (c, z) => {
        setCenter(c);
        setZoom(z);
      },
      onDone: () => setAnimating(false),
      setCancelRef: (fn) => (cancelAnimRef.current = fn),
    });
  };

  React.useEffect(() => {
    return () => {
      if (cancelAnimRef.current) cancelAnimRef.current();
    };
  }, []);

  // render de labels sem duplicar e com contraste alto
  const renderLabels = (geographies) => {
    const seen = new Set();
    return geographies.map((geo) => {
      const name = geo.properties.name;
      const uf = NAME_TO_UF[name] || name;
      if (seen.has(uf)) return null; // evita "fantasmas" duplicados
      seen.add(uf);

      const [cx, cy] = geoCentroid(geo);
      const [dx, dy] = labelShift(uf);
      const isDimmed = selectedUF ? uf !== selectedUF : false;

      return (
        <Marker key={`${geo.rsmKey}-label`} coordinates={[cx + dx, cy + dy]}>
          {/* oculta label quando outra UF está selecionada */}
          {!isDimmed && (
            <text
              textAnchor="middle"
              alignmentBaseline="central"
              fontSize={10}
              fontWeight="bold"
              fill="#000000ff"
              strokeWidth={0}
              style={{ pointerEvents: "none" }}
            >
              {uf}
            </text>
          )}
        </Marker>
      );
    });
  };

  return (
    <div className="content">
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h4 className="card-title m-0">Mapa por UF</h4>
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
            >
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2019">2019</option>
            </select>
            {selectedUF && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={resetFocus}
                disabled={animating}
              >
                Voltar ao Brasil
              </button>
            )}
          </div>
        </div>

        <div
          className="card-body"
          style={{
            height: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            willChange: "transform",
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 800 }}
            style={{ width: "90%", height: "90%" }}
          >
            <ZoomableGroup center={center} zoom={zoom}>
              <Geographies geography={geoUrl}>
                {({ geographies }) => (
                  <>
                    {/* Estados */}
                    {geographies.map((geo) => {
                      const name = geo.properties.name;
                      const uf = NAME_TO_UF[name] || name;
                      const v = byUF[uf];
                      const exists = v !== undefined;
                      const isSelected = selectedUF ? uf === selectedUF : true;
                      const isDimmed = selectedUF ? uf !== selectedUF : false;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => !animating && handleClick(geo)}
                          fill={exists ? color(v || 0) : "#EEE"}
                          stroke="#bbb"
                          strokeWidth={isSelected ? 0.6 : 0.4} // borda mais discreta
                          style={{
                            default: {
                              outline: "none",
                              cursor: animating ? "default" : "pointer",
                              opacity: isDimmed ? 0 : 1,
                              transition:
                                "opacity 300ms ease, fill 300ms ease, transform 300ms ease",
                              transform:
                                isSelected && selectedUF
                                  ? "scale(1.03)"
                                  : "scale(1.0)",
                              transformOrigin: "center",
                              transformBox: "fill-box",
                            },
                            hover: { outline: "none", opacity: isDimmed ? 0 : 0.92 },
                            pressed: { outline: "none" },
                          }}
                          pointerEvents={isDimmed || animating ? "none" : "auto"}
                        />
                      );
                    })}

                    {renderLabels(geographies)}
                  </>
                )}
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>
      </div>
    </div>
  );
}
