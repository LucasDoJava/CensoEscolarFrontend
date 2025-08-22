import React from "react";
import api from "../services/api";

import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);


const ANOS = [2019, 2021, 2022, 2023, 2024];
const PER_PAGE = 1000;

const YEAR_COLORS = {
  2019: { border: "#FF6384", background: "rgba(255, 99, 132, .45)" },
  2021: { border: "#FFCD56", background: "rgba(255, 205, 86, .45)" },
  2022: { border: "#4BC0C0", background: "rgba(75, 192, 192, .45)" },
  2023: { border: "#9966FF", background: "rgba(153, 102, 255, .45)" },
  2024: { border: "#36A2EB", background: "rgba(54, 162, 235, .45)" },
};

const DISTINCT_UF_COLORS = [
  "#4477AA","#66CCEE","#228833","#CCBB44","#EE6677","#AA3377","#BBBBBB",
  "#332288","#88CCEE","#44AA99","#117733","#999933","#DDCC77","#CC6677",
  "#882255","#AA4499","#DDDDDD","#1F77B4","#FF7F0E","#2CA02C","#D62728",
  "#9467BD","#8C564B","#E377C2","#7F7F7F","#BCBD22"
];

async function fetchAllInstituicoes(ano, perPage = PER_PAGE) {
  let page = 1;
  let acc = [];
  for (;;) {
    const { data } = await api.get(`/instituicoes/${ano}`, {
      params: { page, per_page: perPage },
    });
    const rows = Array.isArray(data) ? data : [];
    acc = acc.concat(rows);
    if (rows.length < perPage) break;
    page += 1;
  }
  return acc;
}


async function fetchTotalPaginated(path, perPage = PER_PAGE) {
  let page = 1;
  let total = 0;
  for (;;) {
    const { data } = await api.get(path, { params: { page, per_page: perPage } });
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    total += rows.length;
    if (rows.length < perPage) break;
    page += 1;
  }
  return total;
}

function sumBy(arr, key, valueKey = "matriculas_base") {
  const m = new Map();
  for (const r of arr) {
    const k = r?.[key] ?? r?.[`${key}_nome`] ?? null;
    if (!k) continue;
    const v = Number(r?.[valueKey] ?? 0);
    if (!Number.isFinite(v)) continue;
    m.set(k, (m.get(k) || 0) + v);
  }
  return m;
}

function topEntries(mapObj, n = 15) {
  return Array.from(mapObj.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function generateDistinctColors(n) {
  if (n <= DISTINCT_UF_COLORS.length) return DISTINCT_UF_COLORS.slice(0, n);
  const arr = [...DISTINCT_UF_COLORS];
  for (let i = arr.length; i < n; i++) {
    const hue = Math.round((360 * i) / n);
    arr.push(`hsl(${hue} 70% 55%)`);
  }
  return arr;
}


export default function Dashboard() {
  const [totalUFs, setTotalUFs] = React.useState(0);
  const [totalMeso, setTotalMeso] = React.useState(0);
  const [totalMicro, setTotalMicro] = React.useState(0);
  const [totalMunicipios, setTotalMunicipios] = React.useState(0);

  const [pieUF, setPieUF] = React.useState({ labels: [], datasets: [] });
  const [pieRegiao, setPieRegiao] = React.useState({ labels: [], datasets: [] });
  const [barMeso, setBarMeso] = React.useState({ labels: [], datasets: [] });
  const [barMicro, setBarMicro] = React.useState({ labels: [], datasets: [] });

  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
     
        const [ufsTotal, mesoTotal, microTotal, muniTotal] = await Promise.all([
          api.get("/ufs").then(r => (Array.isArray(r.data) ? r.data.length : 0)),
          fetchTotalPaginated("/mesorregioes", 1000),
          fetchTotalPaginated("/microrregioes", 1000),
          fetchTotalPaginated("/municipios", 1000),
        ]);

        setTotalUFs(ufsTotal);
        setTotalMeso(mesoTotal);
        setTotalMicro(microTotal);
        setTotalMunicipios(muniTotal);

        
        const instByYearEntries = await Promise.all(
          ANOS.map(async (ano) => [ano, await fetchAllInstituicoes(ano)])
        );
        const instByYear = Object.fromEntries(instByYearEntries);
        const lastYear = ANOS[ANOS.length - 1];

    
        const sumMesoLast = sumBy(instByYear[lastYear], "mesorregiao_nome");
        const mesoTop = topEntries(sumMesoLast, 15);
        const mesoLabels = mesoTop.map(([k]) => k);
        const barMesoDatasets = ANOS.map((ano) => {
          const sum = sumBy(instByYear[ano], "mesorregiao_nome");
          const data = mesoLabels.map((k) => sum.get(k) || 0);
          const color = YEAR_COLORS[ano];
          return {
            label: `Matrículas • ${ano}`,
            data,
            borderColor: color.border,
            backgroundColor: color.background,
          };
        });
        setBarMeso({ labels: mesoLabels, datasets: barMesoDatasets });

        
        const sumMicroLast = sumBy(instByYear[lastYear], "microrregiao_nome");
        const microTop = topEntries(sumMicroLast, 15);
        const microLabels = microTop.map(([k]) => k);
        const barMicroDatasets = ANOS.map((ano) => {
          const sum = sumBy(instByYear[ano], "microrregiao_nome");
          const data = microLabels.map((k) => sum.get(k) || 0);
          const color = YEAR_COLORS[ano];
          return {
            label: `Matrículas • ${ano}`,
            data,
            borderColor: color.border,
            backgroundColor: color.background,
          };
        });
        setBarMicro({ labels: microLabels, datasets: barMicroDatasets });


        const sumUF = sumBy(instByYear[lastYear], "sigla");
        const ufLabels = Array.from(sumUF.keys()).sort();
        const ufValues = ufLabels.map((k) => sumUF.get(k) || 0);
        const distinct = generateDistinctColors(ufLabels.length);
        setPieUF({
          labels: ufLabels,
          datasets: [
            {
              label: `Matrículas • ${lastYear}`,
              data: ufValues,
              backgroundColor: distinct,
              borderColor: distinct,
              borderWidth: 1,
              hoverOffset: 4,
            },
          ],
        });

  
        const sumReg = sumBy(instByYear[lastYear], "regiao");
        const regLabels = Array.from(sumReg.keys());
        const regValues = regLabels.map((k) => sumReg.get(k) || 0);
        const regColors = ["#2E86AB","#F6C85F","#6FB07F","#B56576","#8D6BD1"];
        setPieRegiao({
          labels: regLabels,
          datasets: [
            {
              label: `Matrículas • ${lastYear}`,
              data: regValues,
              backgroundColor: regColors.slice(0, regLabels.length),
              borderColor: regColors.slice(0, regLabels.length),
              borderWidth: 1,
              hoverOffset: 4,
            },
          ],
        });
      } catch (e) {
        console.error(e);
        setErro("Falha ao carregar dados do dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="content p-4">Carregando…</div>;
  if (erro) return <div className="content p-4 text-danger">{erro}</div>;

  const barOptions = (titulo) => ({
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: titulo },
      tooltip: { mode: "index", intersect: false },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: { y: { beginAtZero: true } },
    maintainAspectRatio: false,
  });

  const pieOptions = {
    plugins: { legend: { position: "bottom" } },
    maintainAspectRatio: false,
  };

  const lastYear = ANOS[ANOS.length - 1];

  return (
    <div className="content">
 
      <div className="row">
        <div className="col-md-3"><div className="card p-3"><h6>TOTAL DE UFs</h6><h3>{totalUFs}</h3></div></div>
        <div className="col-md-3"><div className="card p-3"><h6>TOTAL DE MESORREGIÕES</h6><h3>{totalMeso}</h3></div></div>
        <div className="col-md-3"><div className="card p-3"><h6>TOTAL DE MICRORREGIÕES</h6><h3>{totalMicro}</h3></div></div>
        <div className="col-md-3"><div className="card p-3"><h6>TOTAL DE MUNICÍPIOS</h6><h3>{totalMunicipios}</h3></div></div>
      </div>

    
      <div className="row">
        <div className="col-md-6"><div className="card" style={{ minHeight: 420 }}>
          <div className="card-header"><h4 className="card-title">Matrículas por Mesorregião (Top 15)</h4></div>
          <div className="card-body"><Bar data={barMeso} options={barOptions("Matrículas por Mesorregião")} /></div>
        </div></div>
        <div className="col-md-6"><div className="card" style={{ minHeight: 420 }}>
          <div className="card-header"><h4 className="card-title">Matrículas por Microrregião (Top 15)</h4></div>
          <div className="card-body"><Bar data={barMicro} options={barOptions("Matrículas por Microrregião")} /></div>
        </div></div>
      </div>


      <div className="row">
        <div className="col-md-6"><div className="card" style={{ minHeight: 380 }}>
          <div className="card-header"><h4 className="card-title">Matrículas por UF — {lastYear}</h4></div>
          <div className="card-body"><Pie data={pieUF} options={pieOptions} /></div>
        </div></div>
        <div className="col-md-6"><div className="card" style={{ minHeight: 380 }}>
          <div className="card-header"><h4 className="card-title">Matrículas por Região — {lastYear}</h4></div>
          <div className="card-body"><Pie data={pieRegiao} options={pieOptions} /></div>
        </div></div>
      </div>
    </div>
  );
}
