import { useEffect, useState } from 'react'
import './App.css'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useNavigate } from 'react-router-dom'

function App() {
  const navigate = useNavigate()
  const spotsLeft = 0

  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsub()
  }, [])

  return (
    <div className="landing-container">
      <h1 className="landing-title">Meetingsfor1000</h1>
      <p className="landing-subtitle">
        Book a meeting directly with a VC investor.<br />
        <span>Exclusively for 1000 founders</span><br />
        <span className="spots-left"><span className="flicker">{spotsLeft}</span> spots left</span>
      </p>
      <button className="login-btn" onClick={() => navigate('/login')}>
        Log In
      </button>
    </div>
  )
}

export default App
