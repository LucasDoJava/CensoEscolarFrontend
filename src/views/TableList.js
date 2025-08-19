import React from "react";
import api from "../services/api";
import { Table, Pagination, Form, Row, Col } from "react-bootstrap";

export default function TableList() {
  const [rows, setRows] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [ano, setAno] = React.useState("");
  const [uf, setUf] = React.useState("");
  const limit = 10;

  React.useEffect(() => {
    (async () => {
      const params = { _page: page, _limit: limit, _sort: "entidade", _order: "asc" };
      if (ano) params.ano = ano;
      if (uf) params.sg_uf = uf;

      const resp = await api.get("/instituicoes", { params });
      setRows(resp.data);
      const totalCount = Number(resp.headers["x-total-count"] || 0);
      setTotal(totalCount);
    })().catch(console.error);
  }, [page, ano, uf]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="content">
      <div className="card">
        <div className="card-header"><h4 className="card-title">Instituições</h4></div>
        <div className="card-body">
          <Form className="mb-3">
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Ano</Form.Label>
                  <Form.Control as="select" value={ano} onChange={e => { setPage(1); setAno(e.target.value); }}>
                    <option value="">Todos</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>UF</Form.Label>
                  <Form.Control as="select" value={uf} onChange={e => { setPage(1); setUf(e.target.value); }}>
                    <option value="">Todas</option>
                    <option value="AM">AM</option>
                    <option value="PA">PA</option>
                    <option value="RO">RO</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
          </Form>

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
              {rows.map(r => (
                <tr key={r.codentidade}>
                  <td>{r.entidade}</td>
                  <td>{r.ano}</td>
                  <td>{r.sg_uf}</td>
                  <td>{r.municipio_nome}</td>
                  <td>{r.qt_mat_bas}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="mt-3">
            <Pagination.Prev disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next disabled={page>=totalPages} onClick={() => setPage(p => p+1)} />
          </Pagination>
        </div>
      </div>
    </div>
  );
}
