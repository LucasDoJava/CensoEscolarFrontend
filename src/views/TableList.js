import React from "react";
import api from "../services/api";
import { Table, Pagination, Form, Row, Col, Alert, Button, Modal } from "react-bootstrap";

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
  const [successMessage, setSuccessMessage] = React.useState("");
  
  // Estados para os modais
  const [showModal, setShowModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingInstitution, setEditingInstitution] = React.useState(null);
  
  const [formData, setFormData] = React.useState({
    regiao: "",
    codregiao: "",
    sigla: "",
    uf_nome: "",
    coduf: "",
    municipio_nome: "",
    codmunicipio: "",
    mesorregiao_nome: "",
    codmesorregiao: "",
    microrregiao_nome: "",
    codmicrorregiao: "",
    entidade: "",
    codentidade: "",
    matriculas_base: "",
    ano: ""
  });
  
  const [loading, setLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState(null);
  const [updatingId, setUpdatingId] = React.useState(null);

  
  const abortControllerRef = React.useRef(null);

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

  const loadData = React.useCallback(async () => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setErro(null);

    try {
      if (ano) {
        const { rows, hasNext } = await fetchAnoEspecifico({
          ano,
          uf,
          page,
          per_page: PAGE_LIMIT,
          signal: abortController.signal
        });
        if (!abortController.signal.aborted) {
          setRows(rows);
          setHasNext(hasNext);
        }
      } else {
        const { rows, hasNext } = await fetchTodosAnos({
          uf,
          page,
          per_page: PAGE_LIMIT,
          signal: abortController.signal
        });
        if (!abortController.signal.aborted) {
          setRows(rows);
          setHasNext(hasNext);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Requisição cancelada');
        return;
      }
      console.error(e);
      if (!abortController.signal.aborted) {
        setRows([]);
        setHasNext(false);
        setErro("Não foi possível carregar as instituições.");
      }
    }

    return () => {
      abortController.abort();
    };
  }, [page, ano, uf]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      
      const dadosParaEnviar = {
        ...formData,
        codregiao: Number(formData.codregiao),
        coduf: Number(formData.coduf),
        codmunicipio: Number(formData.codmunicipio),
        codmesorregiao: Number(formData.codmesorregiao),
        codmicrorregiao: Number(formData.codmicrorregiao),
        codentidade: Number(formData.codentidade),
        matriculas_base: Number(formData.matriculas_base),
        ano: Number(formData.ano)
      };

      console.log('Dados enviados:', dadosParaEnviar);
      
      const response = await api.post('/instituicoes', dadosParaEnviar);
      
      if (response.status === 201) {
        setSuccessMessage("Instituição cadastrada com sucesso!");
        setFormData({
          regiao: "",
          codregiao: "",
          sigla: "",
          uf_nome: "",
          coduf: "",
          municipio_nome: "",
          codmunicipio: "",
          mesorregiao_nome: "",
          codmesorregiao: "",
          microrregiao_nome: "",
          codmicrorregiao: "",
          entidade: "",
          codentidade: "",
          matriculas_base: "",
          ano: ""
        });
        
        setTimeout(() => {
          setShowModal(false);
          setSuccessMessage("");
          setPage(1);
          loadData();
        }, 1500);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Requisição cancelada');
        return;
      }
      
      console.error("Erro completo:", error);
      if (error.response?.data) {
        console.error("Resposta do servidor:", error.response.data);
        if (error.response.data.detalhes) {
          setErro(`${error.response.data.mensagem} Detalhes: ${JSON.stringify(error.response.data.detalhes)}`);
        } else {
          setErro(error.response.data.mensagem || `Erro ${error.response.status} do servidor`);
        }
      } else if (error.request) {
        setErro("Sem resposta do servidor. Verifique se está rodando.");
      } else {
        setErro("Erro ao configurar a requisição: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (institution) => {
    setEditingInstitution(institution);
    setFormData({
      regiao: institution.regiao || "",
      codregiao: institution.codregiao || "",
      sigla: institution.sigla || institution.sg_uf || "",
      uf_nome: institution.uf_nome || institution.no_estado || "",
      coduf: institution.coduf || "",
      municipio_nome: institution.municipio_nome || institution.no_municipio || "",
      codmunicipio: institution.codmunicipio || "",
      mesorregiao_nome: institution.mesorregiao_nome || "",
      codmesorregiao: institution.codmesorregiao || "",
      microrregiao_nome: institution.microrregiao_nome || "",
      codmicrorregiao: institution.codmicrorregiao || "",
      entidade: institution.entidade || institution.no_entidade || "",
      codentidade: institution.codentidade || institution.co_entidade || "",
      matriculas_base: institution.matriculas_base || institution.qt_mat_bas || "",
      ano: institution.ano || institution.nu_ano_censo || ""
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdatingId(editingInstitution.codentidade || editingInstitution.co_entidade);
    setErro(null);

    try {
      
      const dadosParaEnviar = {
        ...formData,
        codregiao: Number(formData.codregiao),
        coduf: Number(formData.coduf),
        codmunicipio: Number(formData.codmunicipio),
        codmesorregiao: Number(formData.codmesorregiao),
        codmicrorregiao: Number(formData.codmicrorregiao),
        codentidade: Number(formData.codentidade),
        matriculas_base: Number(formData.matriculas_base),
        ano: Number(formData.ano)
      };

      const ano = editingInstitution.ano || editingInstitution.nu_ano_censo;
      const codentidade = editingInstitution.codentidade || editingInstitution.co_entidade;
      
      const response = await api.put(`/instituicoes/${ano}/${codentidade}`, dadosParaEnviar);
      
      if (response.status === 200) {
        setSuccessMessage("Instituição atualizada com sucesso!");
        setTimeout(() => {
          setShowEditModal(false);
          setEditingInstitution(null);
          setSuccessMessage("");
          loadData();
        }, 1500);
      }
    } catch (error) {
      console.error("Erro ao atualizar instituição:", error);
      if (error.response?.data) {
        console.error("Resposta do servidor:", error.response.data);
        if (error.response.data.detalhes) {
          setErro(`${error.response.data.mensagem} Detalhes: ${JSON.stringify(error.response.data.detalhes)}`);
        } else {
          setErro(error.response.data.mensagem || `Erro ${error.response.status} ao atualizar`);
        }
      } else {
        setErro("Erro ao atualizar instituição. Tente novamente.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (ano, codentidade, entidade) => {
    if (!window.confirm(`Tem certeza que deseja excluir a instituição "${entidade}"?`)) {
      return;
    }

    setDeletingId(codentidade);
    setErro(null);

    try {
      const response = await api.delete(`/instituicoes/${ano}/${codentidade}`);
      
      if (response.status === 200) {
        setSuccessMessage(`Instituição "${entidade}" excluída com sucesso!`);
        setTimeout(() => {
          setSuccessMessage("");
          loadData();
        }, 2000);
      }
    } catch (error) {
      console.error("Erro ao excluir instituição:", error);
      if (error.response?.data) {
        setErro(error.response.data.mensagem || `Erro ao excluir instituição: ${error.response.status}`);
      } else {
        setErro("Erro ao excluir instituição. Tente novamente.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const totalPagesHint = hasNext ? `${page}+` : `${page}`;

  return (
    <div className="content">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h4 className="card-title">Instituições</h4>
          <Button 
            variant="primary" 
            onClick={() => setShowModal(true)}
          >
            Nova Instituição
          </Button>
        </div>
        <div className="card-body">
          {successMessage && (
            <Alert variant="success" className="py-2">
              {successMessage}
            </Alert>
          )}

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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const codentidade = r.codentidade ?? r.co_entidade;
                  const ano = r.ano ?? r.nu_ano_censo;
                  const entidade = r.entidade ?? r.no_entidade;
                  
                  return (
                    <tr key={codentidade ?? `${entidade}-${ano}-${idx}`}>
                      <td>{entidade}</td>
                      <td>{ano}</td>
                      <td>{r.sigla ?? r.sg_uf}</td>
                      <td>{r.municipio_nome ?? r.no_municipio}</td>
                      <td>{r.matriculas_base ?? r.qt_mat_bas ?? 0}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleEdit(r)}
                            title="Editar instituição"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={deletingId === codentidade}
                            onClick={() => handleDelete(ano, codentidade, entidade)}
                            title="Excluir instituição"
                          >
                            {deletingId === codentidade ? 'Excluindo...' : 'Excluir'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Modal de Cadastro */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Cadastrar Nova Instituição</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Entidade *</Form.Label>
                  <Form.Control
                    type="text"
                    name="entidade"
                    value={formData.entidade}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código da Entidade *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codentidade"
                    value={formData.codentidade}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ano *</Form.Label>
                  <Form.Control
                    type="number"
                    name="ano"
                    value={formData.ano}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Matrículas Base *</Form.Label>
                  <Form.Control
                    type="number"
                    name="matriculas_base"
                    value={formData.matriculas_base}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Região *</Form.Label>
                  <Form.Control
                    type="text"
                    name="regiao"
                    value={formData.regiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Região *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codregiao"
                    value={formData.codregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>UF (Sigla) *</Form.Label>
                  <Form.Control
                    type="text"
                    name="sigla"
                    value={formData.sigla}
                    onChange={handleInputChange}
                    maxLength={2}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome UF *</Form.Label>
                  <Form.Control
                    type="text"
                    name="uf_nome"
                    value={formData.uf_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código UF *</Form.Label>
                  <Form.Control
                    type="number"
                    name="coduf"
                    value={formData.coduf}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Município *</Form.Label>
                  <Form.Control
                    type="text"
                    name="municipio_nome"
                    value={formData.municipio_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Município *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmunicipio"
                    value={formData.codmunicipio}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mesorregião *</Form.Label>
                  <Form.Control
                    type="text"
                    name="mesorregiao_nome"
                    value={formData.mesorregiao_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Mesorregião *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmesorregiao"
                    value={formData.codmesorregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Microrregião *</Form.Label>
                  <Form.Control
                    type="text"
                    name="microrregiao_nome"
                    value={formData.microrregiao_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Microrregião *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmicrorregiao"
                    value={formData.codmicrorregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de Edição */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Editar Instituição</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdate}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Entidade *</Form.Label>
                  <Form.Control
                    type="text"
                    name="entidade"
                    value={formData.entidade}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código da Entidade *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codentidade"
                    value={formData.codentidade}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ano *</Form.Label>
                  <Form.Control
                    type="number"
                    name="ano"
                    value={formData.ano}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Matrículas Base *</Form.Label>
                  <Form.Control
                    type="number"
                    name="matriculas_base"
                    value={formData.matriculas_base}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Região *</Form.Label>
                  <Form.Control
                    type="text"
                    name="regiao"
                    value={formData.regiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Região *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codregiao"
                    value={formData.codregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>UF (Sigla) *</Form.Label>
                  <Form.Control
                    type="text"
                    name="sigla"
                    value={formData.sigla}
                    onChange={handleInputChange}
                    maxLength={2}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome UF *</Form.Label>
                  <Form.Control
                    type="text"
                    name="uf_nome"
                    value={formData.uf_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código UF *</Form.Label>
                  <Form.Control
                    type="number"
                    name="coduf"
                    value={formData.coduf}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Município *</Form.Label>
                  <Form.Control
                    type="text"
                    name="municipio_nome"
                    value={formData.municipio_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Município *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmunicipio"
                    value={formData.codmunicipio}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mesorregião *</Form.Label>
                  <Form.Control
                    type="text"
                    name="mesorregiao_nome"
                    value={formData.mesorregiao_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Mesorregião *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmesorregiao"
                    value={formData.codmesorregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Microrregião *</Form.Label>
                  <Form.Control
                    type="text"
                    name="microrregiao_nome"
                    value={formData.microrregiao_nome}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código Microrregião *</Form.Label>
                  <Form.Control
                    type="number"
                    name="codmicrorregiao"
                    value={formData.codmicrorregiao}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={updatingId === editingInstitution?.codentidade}>
              {updatingId === editingInstitution?.codentidade ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}