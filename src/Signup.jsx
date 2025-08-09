import { useState } from 'react'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import googleLogo from './assets/google.svg'
import { auth, googleProvider, db } from './firebase'
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const STARTING_TOKENS = 100

function Signup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const ensureUserDoc = async (uid) => {
    const userRef = doc(db, 'users', uid)
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      await setDoc(userRef, { tokens: STARTING_TOKENS, createdAt: serverTimestamp() })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      await ensureUserDoc(cred.user.uid)
      navigate('/dashboard') // Redirect to dashboard after successful signup
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setError('Email already in use')
      } else if (error.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters')
      } else {
        setError('Signup failed')
      }
      console.error('Signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError('')
    setLoading(true)

    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await ensureUserDoc(cred.user.uid)
      navigate('/dashboard') // Redirect to dashboard after successful signup
    } catch (error) {
      setError('Google signup failed')
      console.error('Google signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="login-title">Sign Up</h2>
        {error && <div className="error-message">{error}</div>}
        <input 
          type="text" 
          name="username"
          placeholder="Username" 
          className="login-input" 
          value={formData.username}
          onChange={handleInputChange}
          required 
        />
        <input 
          type="email" 
          name="email"
          placeholder="Email" 
          className="login-input" 
          value={formData.email}
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
        <input 
          type="password" 
          name="confirmPassword"
          placeholder="Confirm Password" 
          className="login-input" 
          value={formData.confirmPassword}
          onChange={handleInputChange}
          required 
        />
        <button type="submit" className="login-submit" disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
        <button type="button" className="google-btn" onClick={handleGoogleSignup} disabled={loading}>
          <img src={googleLogo} alt="Google logo" className="google-logo" /> 
          {loading ? 'Signing Up...' : 'Sign Up with Google'}
        </button>
        <div className="signup-link">
          <span>Already have an account? </span>
          <button type="button" className="signup-btn" onClick={() => navigate('/login')}>Log In</button>
        </div>
      </form>
    </div>
  )
}

export default Signup 