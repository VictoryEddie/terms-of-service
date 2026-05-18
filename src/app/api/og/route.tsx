import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#09090b',
              backgroundImage: 'radial-gradient(circle at 50% 50%, #1e1e24 0%, #09090b 100%)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, color: 'white', marginBottom: 20 }}>
              <span style={{ color: '#3b82f6' }}>(</span>To.S<span style={{ color: '#3b82f6' }}>)</span> Analyser
            </div>
            <div style={{ fontSize: 30, color: '#a1a1aa', textAlign: 'center', maxWidth: 800 }}>
              Uncover the fine print. AI-powered Terms of Service analysis.
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    // Fetch data from Firestore (using REST since edge doesn't support full SDK well sometimes, 
    // but next/og runtime 'edge' might have issues with firebase SDK. 
    // Let's use fetch for Firestore REST API for maximum compatibility in edge runtime).
    
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/global_cache/${id}`;
    const res = await fetch(url);
    
    if (!res.ok) {
       // Fallback for missing report
       return new ImageResponse(
        (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', color: 'white', fontSize: 40 }}>
            Report Not Found
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const data = await res.json();
    const fields = data.fields;
    
    const appName = fields.appName?.stringValue || 'Unknown App';
    const grade = fields.grade?.stringValue || '?';
    const score = fields.transparencyScore?.integerValue || fields.transparencyScore?.doubleValue || 0;
    const summary = fields.summary?.stringValue || 'No summary available.';

    const gradeColor = 
      grade.startsWith('A') ? '#10b981' : 
      grade.startsWith('B') ? '#22c55e' : 
      grade.startsWith('C') ? '#eab308' : 
      grade.startsWith('D') ? '#f97316' : '#ef4444';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#09090b',
            padding: '60px',
            position: 'relative',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Background decoration */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '100%', backgroundColor: '#3b82f6', opacity: 0.1, filter: 'blur(80px)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 900, color: 'white' }}>
              <span style={{ color: '#3b82f6' }}>(</span>To.S<span style={{ color: '#3b82f6' }}>)</span>
            </div>
            <div style={{ height: '2px', width: '100px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <div style={{ fontSize: 16, color: '#a1a1aa', fontWeight: 700, letterSpacing: '0.2em' }}>LEGAL AUDIT REPORT</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 72, fontWeight: 900, color: 'white', marginBottom: '10px' }}>{appName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '120px', height: '120px', borderRadius: '24px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: gradeColor }}>{grade}</div>
                <div style={{ fontSize: 12, color: 'white', opacity: 0.5 }}>GRADE</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>{score}/100</div>
                <div style={{ fontSize: 14, color: '#a1a1aa' }}>Transparency Score</div>
              </div>
            </div>
            
            <div style={{ fontSize: 24, color: '#e4e4e7', lineHeight: 1.5, maxWidth: '900px' }}>
              {summary.length > 200 ? summary.substring(0, 197) + '...' : summary}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
            <div style={{ fontSize: 14, color: '#71717a', fontWeight: 600 }}>tos-analyser.vercel.app</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', backgroundColor: '#3b82f6', color: 'white', fontSize: 16, fontWeight: 700 }}>
              View Full Report
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
