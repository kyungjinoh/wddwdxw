import { useState } from 'react'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import googleLogo from './assets/google.svg'
import { auth, googleProvider, db } from './firebase'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const STARTING_TOKENS = 100

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ensureUserDoc = async (uid) => {
    const userRef = doc(db, 'users', uid)
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      await setDoc(userRef, { tokens: STARTING_TOKENS, createdAt: serverTimestamp() })
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, formData.usernameOrEmail, formData.password)
      if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid)
      navigate('/dashboard') // Redirect to dashboard after successful login
    } catch (error) {
      setError('Invalid username/email or password')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await ensureUserDoc(cred.user.uid)
      navigate('/dashboard') // Redirect to dashboard after successful login
    } catch (error) {
      setError('Google login failed')
      console.error('Google login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="login-title">Log In</h2>
        {error && <div className="error-message">{error}</div>}
        <input 
          type="text" 
          name="usernameOrEmail"
          placeholder="Username or Email" 
          className="login-input" 
          value={formData.usernameOrEmail}
          onChange={handleInputChange}
          required 
        />
        <input 
          type="password" 
          name="password"
          placeholder="Password" 
          className="login-input" 
          value={formData.password}
          onChange={handleInputChange}
          required 
        />
        <button type="submit" className="login-submit" disabled={loading}>
          {loading ? 'Logging In...' : 'Log In'}
        </button>
        <button type="button" className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
          <img src={googleLogo} alt="Google logo" className="google-logo" /> 
          {loading ? 'Logging In...' : 'Log In with Google'}
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