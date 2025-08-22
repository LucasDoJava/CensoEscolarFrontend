import React from "react";
import api from "../services/api";
import { Table, Pagination, Form, Row, Col, Alert } from "react-bootstrap";

const UF_FALLBACK = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];


const YEARS_ALL = [2024, 2023, 2022, 2021, 2019];

const PAGE_LIMIT = 10;

function asArray(payload) {
  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.data)
    ? payload.data
    : [];
}

export default function TableList() {
  const [rows, setRows] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasNext, setHasNext] = React.useState(false);

  const [ano, setAno] = React.useState(""); 
  const [uf, setUf] = React.useState("");

  const [ufs, setUfs] = React.useState([]);
  const [erro, setErro] = React.useState(null);


  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ufs");
        const arr = asArray(data);
        let siglas = arr
          .map((u) => u.sigla ?? u.sg_uf ?? u.SIGLA ?? u.SG_UF ?? u.uf ?? "")
          .filter(Boolean);
        siglas = Array.from(new Set(siglas)).sort((a, b) => a.localeCompare(b));
        setUfs(siglas.length ? siglas : UF_FALLBACK);
      } catch {
        setUfs(UF_FALLBACK);
      }
    })();
  }, []);


  async function fetchAnoEspecifico({ ano, uf, page, per_page }) {
    const params = { page, per_page };
    if (uf) params.sigla = uf;

    const resp = await api.get(`/instituicoes/${ano}`, { params });
    const data = asArray(resp.data);
    return {
      rows: data,
      hasNext: data.length === per_page,
    };
  }

  
  async function fetchTodosAnos({ uf, page, per_page }) {
    const needed = page * per_page + 1;
    const acc = [];
    const paramsBase = { per_page, ...(uf ? { sigla: uf } : {}) };

    for (const year of YEARS_ALL) {
      let p = 1;
      for (;;) {
        const { data } = await api.get(`/instituicoes/${year}`, {
          params: { ...paramsBase, page: p },
        });
        const rows = asArray(data).map((r) => ({
          ...r,
          
          ano: r.ano ?? r.nu_ano_censo ?? r.NU_ANO_CENSO ?? year,
        }));

        if (rows.length === 0) break;

        acc.push(...rows);

        if (acc.length >= needed) break;
        if (rows.length < per_page) break; 
        p += 1;
      }
      if (acc.length >= needed) break;
    }


    acc.sort(
      (a, b) =>
        (Number(b.ano) || 0) - (Number(a.ano) || 0) ||
        String(a.entidade || "").localeCompare(String(b.entidade || ""))
    );

    const start = (page - 1) * per_page;
    const pageRows = acc.slice(start, start + per_page);
    const hasNext = acc.length > start + per_page;
    return { rows: pageRows, hasNext };
  }

  React.useEffect(() => {
    (async () => {
      setErro(null);

      try {
        if (ano) {
          // ano específico
          const { rows, hasNext } = await fetchAnoEspecifico({
            ano,
            uf,
            page,
            per_page: PAGE_LIMIT,
          });
          setRows(rows);
          setHasNext(hasNext);
        } else {
        
          const { rows, hasNext } = await fetchTodosAnos({
            uf,
            page,
            per_page: PAGE_LIMIT,
          });
          setRows(rows);
          setHasNext(hasNext);
        }
      } catch (e) {
        console.error(e);
        setRows([]);
        setHasNext(false);
        setErro("Não foi possível carregar as instituições.");
      }
    })();
  }, [page, ano, uf]);

  const totalPagesHint = hasNext ? `${page}+` : `${page}`;

  return (
    <div className="content">
      <div className="card">
        <div className="card-header">
          <h4 className="card-title">Instituições</h4>
        </div>
        <div className="card-body">
          <Form className="mb-3">
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Ano</Form.Label>
                  <Form.Select
                    value={ano}
                    onChange={(e) => {
                      setPage(1);
                      setAno(e.target.value);
                    }}
                  >
                    <option value="">Todos</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                    <option value="2019">2019</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={3}>
                <Form.Group>
                  <Form.Label>UF</Form.Label>
                  <Form.Select
                    value={uf}
                    onChange={(e) => {
                      setPage(1);
                      setUf(e.target.value);
                    }}
                  >
                    <option value="">Todas</option>
                    {ufs.map((sigla) => (
                      <option key={sigla} value={sigla}>
                        {sigla}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>

          {erro && (
            <Alert variant="danger" className="py-2">
              {erro}
            </Alert>
          )}

          <Table hover responsive>
            <thead>
              <tr>
                <th>Entidade</th>
                <th>Ano</th>
                <th>UF</th>
                <th>Município</th>
                <th>Matrículas</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={
                      r.codentidade ??
                      `${r.entidade}-${r.ano}-${r.sigla ?? r.sg_uf ?? ""}-${idx}`
                    }
                  >
                    <td>{r.entidade}</td>
                    <td>{r.ano}</td>
                    <td>{r.sigla ?? r.sg_uf}</td>
                    <td>{r.municipio_nome}</td>
                    <td>{r.matriculas_base ?? r.qt_mat_bas ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>

          <Pagination className="mt-3">
            <Pagination.Prev
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <Pagination.Item active>{totalPagesHint}</Pagination.Item>
            <Pagination.Next
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            />
          </Pagination>
        </div>
      </div>
    </div>
  );
}