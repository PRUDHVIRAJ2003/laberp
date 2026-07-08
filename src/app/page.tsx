import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="bg-vibrant-gradient" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* Navbar */}
      <header className="p-6 flex justify-between items-center w-full relative z-10 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'var(--primary)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }} className="flex justify-center items-center">
            <span style={{ color: 'white', fontWeight: 800, fontSize: '26px', lineHeight: 1 }}>+</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            LAB <span style={{ color: 'var(--primary)' }}>ERP</span>
          </h1>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container relative z-10" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px' }}>
        
        {/* Left Content */}
        <div className="flex-col justify-center animate-fade-in-up delay-100" style={{ flex: 1, maxWidth: '600px', paddingRight: '40px' }}>
          <div style={{ display: 'inline-block', padding: '8px 20px', backgroundColor: 'rgba(66, 133, 244, 0.1)', color: 'var(--google-blue)', borderRadius: '30px', fontWeight: 700, marginBottom: '24px', fontSize: '15px', border: '1px solid rgba(66,133,244,0.2)' }}>
            ✨ Next-Generation Pathology Software
          </div>
          <h2 style={{ fontSize: '72px', fontWeight: 900, color: 'var(--md-sys-color-on-background)', marginBottom: '24px', letterSpacing: '-2px', lineHeight: 1.05 }}>
            Precision Labs, <br/>
            <span className="text-gradient">Delivered Instantly.</span>
          </h2>
          <p style={{ fontSize: '22px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '48px', fontWeight: 400, lineHeight: 1.6 }}>
            Access your medical history securely. A beautifully designed, powerful, and fast reporting platform built for patients and laboratory admins.
          </p>
          
          <div className="flex gap-6">
            <Link href="/patient" className="btn btn-primary" style={{ padding: '0 48px', height: '64px', fontSize: '20px', borderRadius: '32px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span>Patient Login</span>
              <span style={{ fontSize: '24px' }}>→</span>
            </Link>
            <Link href="/admin/login" className="btn btn-outlined glass-card" style={{ padding: '0 48px', height: '64px', fontSize: '20px', borderRadius: '32px', color: 'var(--google-blue)', border: '2px solid var(--google-blue)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span>Admin Portal</span>
              <span style={{ fontSize: '20px' }}>🔒</span>
            </Link>
          </div>
        </div>

        {/* Right Image */}
        <div className="animate-fade-in-up delay-200 animate-float" style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
           {/* Abstract Glow Behind Image */}
           <div style={{ position: 'absolute', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(66,133,244,0.3) 0%, rgba(255,255,255,0) 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: -1, filter: 'blur(40px)' }}></div>
           
           {/* The Generated Hero Image */}
             <Image 
             src="/hero.png" 
             alt="Modern Pathology Lab" 
             width={600} 
             height={600} 
             style={{ objectFit: 'contain', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.15))' }}
             priority
           />
        </div>
      </section>

      {/* Floating Glass Cards Background Elements */}
      <div className="glass-card animate-float delay-300" style={{ position: 'absolute', top: '20%', right: '5%', width: '150px', height: '150px', borderRadius: '30px', transform: 'rotate(15deg)', zIndex: 0, opacity: 0.6 }}></div>
      <div className="glass-card animate-float delay-100" style={{ position: 'absolute', bottom: '15%', left: '45%', width: '100px', height: '100px', borderRadius: '20px', transform: 'rotate(-20deg)', zIndex: 0, opacity: 0.5, background: 'rgba(234, 67, 53, 0.1)' }}></div>
      <div className="glass-card animate-float delay-200" style={{ position: 'absolute', top: '60%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', zIndex: 0, opacity: 0.4, background: 'rgba(251, 188, 5, 0.1)' }}></div>

      {/* Footer */}
      <footer className="relative z-10 w-full p-6" style={{ marginTop: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-color)', width: '100%' }}>
        <div className="container flex justify-between items-center" style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 500 }}>
          <div className="flex items-center gap-2">
             <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700, fontSize: '12px' }}>
               L
             </div>
             <span>powered by opensource</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            design and developed by <strong style={{ color: 'var(--primary)' }}>Prudhvi Raj Chalapaka</strong>
          </div>
        </div>
      </footer>

    </main>
  );
}
