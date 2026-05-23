import { useNavigate } from 'react-router-dom';

interface LockedFeaturePageProps {
  feature: string;
}

export function LockedFeaturePage({ feature }: LockedFeaturePageProps) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 460,
        textAlign: 'center',
        background: '#fffefb',
        border: '1px solid rgba(19, 27, 46, 0.08)',
        borderRadius: 16,
        padding: '2.5rem 2rem',
        boxShadow: '0 10px 28px -20px rgba(19, 27, 46, 0.22)',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          margin: '0 auto 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(224, 123, 60, 0.14)',
          color: '#e07b3c',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#e07b3c',
          marginBottom: 6,
        }}>Premium Feature</div>
        <h1 style={{
          fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
          fontSize: '1.4rem',
          fontWeight: 800,
          color: '#131b2e',
          margin: '0 0 0.5rem',
        }}>{feature} is locked</h1>
        <p style={{
          color: 'rgba(19, 27, 46, 0.65)',
          fontSize: '0.95rem',
          lineHeight: 1.55,
          margin: '0 0 1.5rem',
        }}>
          This module is part of the premium plan. Contact your administrator to
          unlock {feature.toLowerCase()} tracking, reporting, and category insights.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '0.6rem 1.4rem',
            background: '#131b2e',
            color: '#fff',
            border: 0,
            borderRadius: 10,
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
