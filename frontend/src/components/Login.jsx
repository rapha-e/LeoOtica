import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, LogIn, User } from 'lucide-react';
import axios from 'axios';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados do fluxo de Primeiro Acesso
  const [showFirstAccessModal, setShowFirstAccessModal] = useState(false);
  const [tempLoginData, setTempLoginData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstAccessError, setFirstAccessError] = useState('');
  const [firstAccessLoading, setFirstAccessLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    const hostname = window.location.hostname;
    try {
      const response = await axios.post(`http://${hostname}:8000/api/v1/auth/login`, {
        email: email,
        password: password,
      });

      const { access_token, role, name, must_change_password } = response.data;
      
      if (must_change_password) {
        // Retém o fluxo e abre o modal de primeiro acesso
        setTempLoginData({ token: access_token, role, name });
        setShowFirstAccessModal(true);
      } else {
        // Salva no localStorage
        localStorage.setItem('factory_token', access_token);
        localStorage.setItem('token', access_token);
        localStorage.setItem('factory_user_role', role);
        localStorage.setItem('factory_user_name', name);


        // Dispara o callback de sucesso
        onLoginSuccess({ token: access_token, role, name });
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Falha de conexão com o servidor da fábrica.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccessSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setFirstAccessError('Por favor, preencha todos os campos.');
      return;
    }
    if (newPassword.length < 4) {
      setFirstAccessError('A nova senha deve conter no mínimo 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFirstAccessError('As senhas digitadas não coincidem.');
      return;
    }

    setFirstAccessLoading(true);
    setFirstAccessError('');

    const hostname = window.location.hostname;
    try {
      await axios.post(
        `http://${hostname}:8000/api/v1/auth/change-password`,
        { new_password: newPassword },
        {
          headers: {
            Authorization: `Bearer ${tempLoginData.token}`
          }
        }
      );

      // Salva no localStorage as credenciais finais
      localStorage.setItem('factory_token', tempLoginData.token);
      localStorage.setItem('token', tempLoginData.token);
      localStorage.setItem('factory_user_role', tempLoginData.role);
      localStorage.setItem('factory_user_name', tempLoginData.name);


      // Dispara o callback de sucesso
      onLoginSuccess(tempLoginData);
      setShowFirstAccessModal(false);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setFirstAccessError(err.response.data.detail);
      } else {
        setFirstAccessError('Falha ao redefinir senha. Tente novamente.');
      }
    } finally {
      setFirstAccessLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'hsl(var(--bg-deep))',
      backgroundImage: 'radial-gradient(at 0% 0%, hsl(var(--primary) / 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, hsl(var(--secondary) / 0.04) 0px, transparent 50%)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 30px',
        borderRadius: '20px'
      }}>
        {/* Cabeçalho do Login */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '16px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--secondary) / 0.1))',
            border: '1px solid hsl(var(--primary) / 0.25)',
            marginBottom: '20px',
            boxShadow: '0 0 20px hsl(var(--primary) / 0.08)'
          }}>
            <LogIn size={36} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 900,
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px'
          }}>
            Opti<span style={{ color: 'hsl(var(--secondary))' }}>Mind</span>
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'hsl(var(--text-secondary))',
            margin: 0
          }}>
            Painel de Controle de Inventário & Fábrica
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Login de Acesso */}
          <div className="form-group">
            <label style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'hsl(var(--text-secondary))',
              marginBottom: '8px',
              display: 'block'
            }}>
              Login do Operador
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--text-muted))'
              }} />
              <input
                type="text"
                required
                className="form-control"
                placeholder="Ex: admin ou teste"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  paddingLeft: '45px'
                }}
              />
            </div>
          </div>

          {/* Senha */}
          <div className="form-group">
            <label style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'hsl(var(--text-secondary))',
              marginBottom: '8px',
              display: 'block'
            }}>
              Senha de Acesso
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--text-muted))'
              }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  paddingLeft: '45px',
                  paddingRight: '45px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--text-muted))',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '12px',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.8rem'
            }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Botão de Entrar */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              fontWeight: 700,
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Autenticando...' : 'Conectar ao Painel'}
          </button>
        </form>


      </div>

      {/* MODAL: Primeiro Acesso (Troca Obrigatória de Senha) */}
      {showFirstAccessModal && tempLoginData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '35px 30px',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                display: 'inline-flex',
                padding: '12px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                marginBottom: '12px'
              }}>
                <Lock size={28} style={{ color: '#f59e0b' }} />
              </div>
              <h2 style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'white',
                margin: '0 0 8px 0'
              }}>
                Primeiro Acesso
              </h2>
              <p style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--text-secondary))',
                margin: 0,
                lineHeight: '1.4'
              }}>
                Para sua segurança, você deve definir uma nova senha personalizada antes de acessar o painel.
              </p>
            </div>

            <form onSubmit={handleFirstAccessSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '6px', display: 'block' }}>
                  Nova Senha
                </label>
                <input
                  type="password"
                  required
                  className="form-control"
                  placeholder="Mínimo 4 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '6px', display: 'block' }}>
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  className="form-control"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {firstAccessError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '10px',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.8rem'
                }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{firstAccessError}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={firstAccessLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {firstAccessLoading ? 'Salvando...' : 'Definir Senha & Acessar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
