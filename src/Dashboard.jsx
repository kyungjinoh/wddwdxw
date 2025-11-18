import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, getDoc, setDoc, runTransaction, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import Papa from 'papaparse'
import './Dashboard.css'

const STARTING_TOKENS = 100
const COST_EMAIL = 5
const COST_CALENDLY = 10

// Ensure Calendly links always go to https://calendly.com/... even if CSV has
// values like "calendly.com/xyz" or site-relative links such as
// "https://www.meetingsfor1000.com/calendly.com/xyz"
const normalizeCalendlyLink = (value) => {
  if (!value) return ''
  let href = String(value).trim()
  // Strip our own domain prefix if present
  href = href.replace(/^https?:\/\/(www\.)?meetingsfor1000\.com\//i, '')
  // Normalize www/calendly variants to canonical
  href = href.replace(/^https?:\/\/www\.calendly\.com/i, 'https://calendly.com')
  href = href.replace(/^http:\/\/(www\.)?calendly\.com/i, 'https://calendly.com')
  // If no protocol and starts with calendly.com/... add https
  if (/^calendly\.com\//i.test(href)) {
    href = `https://${href}`
  }
  return href
}

function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentUser, setCurrentUser] = useState(null)
  const [tokens, setTokens] = useState(STARTING_TOKENS)
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState('directory') // 'directory' | 'revealed'
  const [revealsByKey, setRevealsByKey] = useState({}) // { [rowKey]: { title, company, email?, calendlyLinks?[] } }
  const itemsPerPage = 20

  const [spendingEmailKey, setSpendingEmailKey] = useState(null)
  const [spendingCalendlyKey, setSpendingCalendlyKey] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        navigate('/', { replace: true })
        return
      }
      // Ensure user doc exists and load tokens
      const userRef = doc(db, 'users', user.uid)
      const snap = await getDoc(userRef)
      if (!snap.exists()) {
        await setDoc(userRef, { tokens: STARTING_TOKENS, createdAt: serverTimestamp() })
        setTokens(STARTING_TOKENS)
      } else {
        const t = snap.data()?.tokens ?? STARTING_TOKENS
        setTokens(t)
      }
      // Load saved reveals
      const revSnap = await getDocs(collection(db, 'users', user.uid, 'reveals'))
      const revMap = {}
      revSnap.forEach(ds => {
        const d = ds.data() || {}
        const normalized = Array.isArray(d.calendlyLinks) ? d.calendlyLinks.map(normalizeCalendlyLink) : undefined
        revMap[ds.id] = { ...d, calendlyLinks: normalized || d.calendlyLinks }
      })
      setRevealsByKey(revMap)
    })
    return () => unsub()
  }, [navigate])

  useEffect(() => {
    loadCSVData()
  }, [])

  useEffect(() => {
    filterData()
  }, [searchTerm, data])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const spendTokens = async (cost, meta) => {
    if (!currentUser) return { ok: false, reason: 'Not signed in' }
    const userRef = doc(db, 'users', currentUser.uid)
    try {
      const newTokens = await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef)
        const current = (snap.exists() ? snap.data().tokens : STARTING_TOKENS)
        if (current < cost) throw new Error('insufficient')
        const updated = current - cost
        tx.set(userRef, { tokens: updated }, { merge: true })
        return updated
      })
      setTokens(newTokens)
      await addDoc(collection(db, 'token_logs'), {
        uid: currentUser.uid,
        cost,
        remaining: newTokens,
        meta,
        ts: serverTimestamp(),
      })
      return { ok: true, remaining: newTokens }
    } catch (e) {
      if (import.meta.env?.DEV) {
        const simulated = Math.max(0, tokens - cost)
        setTokens(simulated)
        return { ok: true, remaining: simulated, dev: true }
      }
      return { ok: false, reason: e?.message || 'Unknown error' }
    }
  }

  const loadCSVData = async () => {
    try {
      const response = await fetch('/1,2,3 - 시트1.cleaned.csv')
      const csvText = await response.text()
      
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          setData(results.data.filter(row => row.Title))
          setLoading(false)
        },
        error: (error) => {
          console.error('Error parsing CSV:', error)
          setLoading(false)
        }
      })
    } catch (error) {
      console.error('Error loading CSV:', error)
      setLoading(false)
    }
  }

  const filterData = () => {
    if (!searchTerm.trim()) {
      setFilteredData(data)
      return
    }

    const filtered = data.filter(row => 
      row.Title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.Categories?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredData(filtered)
    setCurrentPage(1)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredData.slice(startIndex, endIndex)
  }

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const getRowKey = (row) => {
    const lastColValue = row[Object.keys(row)[Object.keys(row).length - 1]] || ''
    return encodeURIComponent(`${row.Title || ''}|${row.Company || ''}|${row.Email || ''}|${lastColValue}`)
  }

  const revealEmail = async (rowKey, row) => {
    const emailValue = row.Email
    if (!emailValue || spendingEmailKey === rowKey) return
    setSpendingEmailKey(rowKey)
    const res = await spendTokens(COST_EMAIL, { type: 'email', rowKey })
    if (res.ok) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'reveals', rowKey)
        await setDoc(docRef, { email: emailValue, title: row.Title || '', company: row.Company || '' }, { merge: true })
        setRevealsByKey(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), email: emailValue, title: row.Title || '', company: row.Company || '' } }))
        showToast(`-${COST_EMAIL} tokens. Remaining: ${res.remaining}`)
      } catch (e) {
        console.error('Saving email reveal failed:', e)
        showToast('Could not save reveal. Check Firestore rules for users/{uid}/reveals/*')
        if (import.meta.env?.DEV) {
          setRevealsByKey(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), email: emailValue, title: row.Title || '', company: row.Company || '' } }))
        }
      }
    } else {
      showToast(res.reason || 'Failed to reveal email')
      console.error('Reveal email failed:', res)
    }
    setSpendingEmailKey(null)
  }

  const revealCalendly = async (rowKey, row) => {
    const lastColValue = row[Object.keys(row)[Object.keys(row).length - 1]]
    const calendlyLinksRaw = typeof lastColValue === 'string' ? lastColValue.split(',').map(s => s.trim()).filter(Boolean) : []
    const calendlyLinks = calendlyLinksRaw.map(normalizeCalendlyLink)
    if (!calendlyLinks.length || spendingCalendlyKey === rowKey) return
    setSpendingCalendlyKey(rowKey)
    const res = await spendTokens(COST_CALENDLY, { type: 'calendly', rowKey })
    if (res.ok) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'reveals', rowKey)
        await setDoc(docRef, { calendlyLinks, title: row.Title || '', company: row.Company || '' }, { merge: true })
        setRevealsByKey(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), calendlyLinks, title: row.Title || '', company: row.Company || '' } }))
        showToast(`-${COST_CALENDLY} tokens. Remaining: ${res.remaining}`)
      } catch (e) {
        console.error('Saving calendly reveal failed:', e)
        showToast('Could not save reveal. Check Firestore rules for users/{uid}/reveals/*')
        if (import.meta.env?.DEV) {
          setRevealsByKey(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), calendlyLinks, title: row.Title || '', company: row.Company || '' } }))
        }
      }
    } else {
      showToast(res.reason || 'Failed to reveal Calendly')
      console.error('Reveal calendly failed:', res)
    }
    setSpendingCalendlyKey(null)
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Meetingsfor1000</h1>
        <div className="header-controls">
          <input
            type="text"
            placeholder="Search by name, company, position, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {currentUser && (
            <div className="user-email">{currentUser.email}</div>
          )}
          <div className="tokens-chip">Tokens: {tokens}</div>
          <button onClick={handleLogout} className="logout-btn">
            Log Out
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')}>Directory</button>
        <button className={`tab-btn ${activeTab === 'revealed' ? 'active' : ''}`} onClick={() => setActiveTab('revealed')}>Revealed</button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="dashboard-content">
        {activeTab === 'directory' && (
          <>
            <div className="stats-bar">
              <span>Total Investors: {filteredData.length}</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>

            <div className="table-container">
              <table className="investors-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Position</th>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Calendly</th>
                    <th>Website</th>
                    <th>Linkedin</th>
                    <th>Facebook</th>
                    <th>X / Twitter</th>
                    <th>Github</th>
                    <th>Crunchbase</th>
                    <th>Angellist</th>
                    <th>Categories</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Fund Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentPageData().map((row, index) => {
                    const rowKey = getRowKey(row)
                    const lastColValue = row[Object.keys(row)[Object.keys(row).length - 1]]
                    const calendlyLinks = (typeof lastColValue === 'string' 
                      ? lastColValue.split(',').map((s) => normalizeCalendlyLink(s.trim())).filter(Boolean)
                      : [])
                    const emailValue = row.Email
                    const emailRevealed = !!(revealsByKey[rowKey]?.email)
                    const calendlyRevealed = !!(revealsByKey[rowKey]?.calendlyLinks?.length)
                    return (
                      <tr key={rowKey}>
                        <td>{row.Title}</td>
                        <td>{row.Position}</td>
                        <td>{row.Company}</td>
                        <td>
                          {emailRevealed ? (
                            <a href={`mailto:${emailValue}`} className="email-link">{emailValue}</a>
                          ) : emailValue ? (
                            <button className="reveal-btn" onClick={() => revealEmail(rowKey, row)} disabled={spendingEmailKey === rowKey}>
                              Reveal Email (-{COST_EMAIL})
                            </button>
                          ) : ''}
                        </td>
                        <td>
                          {calendlyRevealed ? (
                            <div className="calendly-links">
                              {(revealsByKey[rowKey]?.calendlyLinks || calendlyLinks).map((href, i) => (
                                <a
                                  key={i}
                                  href={normalizeCalendlyLink(href)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="calendly-link"
                                >
                                  Book Meeting
                                </a>
                              ))}
                            </div>
                          ) : calendlyLinks.length ? (
                            <button className="reveal-btn" onClick={() => revealCalendly(rowKey, row)} disabled={spendingCalendlyKey === rowKey}>
                              Reveal Calendly (-{COST_CALENDLY})
                            </button>
                          ) : ''}
                        </td>
                        <td>{row.Website ? <a href={row.Website} target="_blank" rel="noopener noreferrer" className="company-website">Website</a> : ''}</td>
                        <td>{row.Linkedin ? <a href={row.Linkedin} target="_blank" rel="noopener noreferrer">Linkedin</a> : ''}</td>
                        <td>{row.Facebook ? <a href={row.Facebook} target="_blank" rel="noopener noreferrer">Facebook</a> : ''}</td>
                        <td>{row['X / Twitter'] ? <a href={row['X / Twitter']} target="_blank" rel="noopener noreferrer">X / Twitter</a> : ''}</td>
                        <td>{row.Github ? <a href={row.Github} target="_blank" rel="noopener noreferrer">Github</a> : ''}</td>
                        <td>{row.Crunchbase ? <a href={row.Crunchbase} target="_blank" rel="noopener noreferrer">Crunchbase</a> : ''}</td>
                        <td>{row.Angellist ? <a href={row.Angellist} target="_blank" rel="noopener noreferrer">Angellist</a> : ''}</td>
                        <td>
                          <div className="categories">
                            {row.Categories?.split('\n').map((category, i) => (
                              <span key={i} className="category-tag">{category.trim()}</span>
                            ))}
                          </div>
                        </td>
                        <td>{row.City}</td>
                        <td>{row.State}</td>
                        <td>
                          <div className="fund-stage">
                            {row['Fund Stage']?.split('\n').map((stage, i) => (
                              <span key={i} className="stage-tag">{stage.trim()}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="page-btn"
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="page-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'revealed' && (
          <div className="table-container">
            <table className="investors-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Calendly</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(revealsByKey).map(([key, rev]) => (
                  <tr key={key}>
                    <td>{rev.title || ''}</td>
                    <td>{rev.company || ''}</td>
                    <td>{rev.email ? <a href={`mailto:${rev.email}`} className="email-link">{rev.email}</a> : ''}</td>
                    <td>
                      <div className="calendly-links">
                        {(rev.calendlyLinks || []).map((href, i) => (
                          <a key={i} href={normalizeCalendlyLink(href)} target="_blank" rel="noopener noreferrer" className="calendly-link">Book Meeting</a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard 
