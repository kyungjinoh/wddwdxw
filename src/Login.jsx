import { useState } from 'react'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import googleLogo from './assets/google.svg'

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: ''
  })

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const blockSignIn = (e) => {
    e.preventDefault()
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={blockSignIn}>
        <h2 className="login-title">Log In</h2>
        <div className="error-message">Sign in is closed.</div>
        <input 
          type="text" 
          name="usernameOrEmail"
          placeholder="Username or Email" 
          className="login-input" 
          value={formData.usernameOrEmail}
          onChange={handleInputChange}
          disabled
        />
        <input 
          type="password" 
          name="password"
          placeholder="Password" 
          className="login-input" 
          value={formData.password}
          onChange={handleInputChange}
          disabled
        />
        <button type="submit" className="login-submit" disabled>
          Log In
        </button>
        <button type="button" className="google-btn" disabled>
          <img src={googleLogo} alt="Google logo" className="google-logo" /> 
          Log In with Google
        </button>
        <div className="signup-link">
          <span>Don't have an account? </span>
          <button type="button" className="signup-btn" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      </form>
    </div>
  )
}

export default Login
