import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { store } from '@/store'
import { loginSuccess } from '@/store/reducers/authSlice'
import client from '@/api/client'

const ExternalSSOSuccess = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const [status, setStatus] = useState('Initializing...')
    const [error, setError] = useState(null)

    useEffect(() => {
        const run = async () => {
            try {
                setStatus('Extracting token from URL...')
                const queryParams = new URLSearchParams(location.search)
                const token = queryParams.get('token')

                if (!token) {
                    setError('No authentication token found in URL')
                    setStatus('Authentication failed')
                    setTimeout(() => navigate('/login'), 3000)
                    return
                }

                setStatus('Validating token with server...')
                const response = await client.get(`/external-sso/success?token=${token}`)

                if (response && response.data) {
                    setStatus('Authentication successful! Redirecting...')
                    store.dispatch(loginSuccess(response.data))
                    navigate('/chatflows')
                } else {
                    setError('Invalid server response')
                    setStatus('Authentication failed')
                    setTimeout(() => navigate('/login'), 3000)
                }
            } catch (error) {
                setError(error?.response?.data?.message || error?.message || 'Unknown error')
                setStatus('Authentication failed')
                setTimeout(() => navigate('/login'), 3000)
            }
        }
        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ color: error ? '#d32f2f' : '#1976d2' }}>External SSO Authentication</h1>
            <p style={{ fontSize: '18px', margin: '20px 0' }}>{status}</p>
            {error && (
                <div
                    style={{
                        background: '#ffebee',
                        border: '1px solid #d32f2f',
                        padding: '20px',
                        borderRadius: '4px',
                        color: '#d32f2f',
                        marginTop: '20px'
                    }}
                >
                    <strong>Error:</strong> {error}
                    <br />
                    <small>Check browser console for details. Redirecting to login in 3 seconds...</small>
                </div>
            )}
            {!error && (
                <div style={{ marginTop: '20px' }}>
                    <div
                        className="spinner"
                        style={{
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #1976d2',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto'
                        }}
                    ></div>
                    <style>
                        {`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}
                    </style>
                </div>
            )}
        </div>
    )
}

export default ExternalSSOSuccess
