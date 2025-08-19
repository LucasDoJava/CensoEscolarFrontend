import React from "react";
import ChartistGraph from "react-chartist";
import api from "../services/api";

// se já existir, reaproveite suas options/responsiveOptions
const optionsBar = { seriesBarDistance: 10, axisX: { showGrid: false }, height: "245px" };
const optionsLine = { low: 0, showArea: true, height: "245px" };
const optionsPie  = { height: "245px", donut: true, donutWidth: 40 };
const responsiveBar = [['screen and (max-width: 640px)', { seriesBarDistance: 5 }]];

export default function Dashboard() {
  const [stats, setStats] = React.useState(null);
  const [barUF, setBarUF] = React.useState({ labels: [], series: [[]] });
  const [lineMes, setLineMes] = React.useState({ labels: [], series: [[]] });
  const [pieRegiao, setPieRegiao] = React.useState({ series: [] });
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [{ data: statsOv }, { data: uf }, { data: mes }, { data: reg }] = await Promise.all([
          api.get("/stats_overview"),
          api.get("/matriculas_por_uf"),
          api.get("/matriculas_por_mes"),
          api.get("/matriculas_por_regiao"),
        ]);

        setStats(statsOv);
        setBarUF({ labels: uf.map(x => x.sg_uf), series: [uf.map(x => Number(x.total)||0)] });
        setLineMes({ labels: mes.map(x => x.mes), series: [mes.map(x => Number(x.total)||0)] });
        setPieRegiao({ series: reg.map(x => Number(x.total)||0) });
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

  return (
    <div className="content">
      <div className="row">
        {/* Cards de KPIs (exemplo simples) */}
        <div className="col-md-4"><div className="card p-3"><h6>Total Instituições</h6><h3>{stats.total_instituicoes}</h3></div></div>
        <div className="col-md-4"><div className="card p-3"><h6>Total Matrículas</h6><h3>{stats.total_matriculas}</h3></div></div>
        <div className="col-md-4"><div className="card p-3"><h6>Anos</h6><h3>{stats.anos_disponiveis.join(", ")}</h3></div></div>
      </div>

      <div className="row">
        {/* Bar: por UF */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h4 className="card-title">Matrículas por UF</h4></div>
            <div className="card-body">
              <ChartistGraph data={barUF} type="Bar" options={optionsBar} responsiveOptions={responsiveBar} />
            </div>
          </div>
        </div>

        {/* Line: por mês */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h4 className="card-title">Matrículas por Mês</h4></div>
            <div className="card-body">
              <ChartistGraph data={lineMes} type="Line" options={optionsLine} />
            </div>
          </div>
        </div>
      </div>

      {/* Pie: por região */}
      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h4 className="card-title">Por Região</h4></div>
            <div className="card-body">
              <ChartistGraph data={pieRegiao} type="Pie" options={optionsPie} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
