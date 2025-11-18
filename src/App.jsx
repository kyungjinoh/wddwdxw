import { useEffect, useState } from 'react'
import './App.css'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './firebase'
import { collection, getCountFromServer } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

function App() {
  const navigate = useNavigate()
  const [registeredCount, setRegisteredCount] = useState(0)
  const spotsLeft = Math.max(0, 1000 - registeredCount)

  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const q = collection(db, 'users')
        const snapshot = await getCountFromServer(q)
        const count = snapshot.data().count || 0
        setRegisteredCount(count)
      } catch (e) {
        // Fail silently; keep default 0 if counting not available
        console.error('Failed to get user count:', e)
      }
    }
    fetchUserCount()
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
