import './BrandLoader.css';

export default function BrandLoader({ fullScreen = false, label = 'Loading Nexnoon' }: { fullScreen?: boolean; label?: string }) {
  return <div className={`brand-loader${fullScreen ? ' brand-loader--screen' : ''}`} role="status" aria-label={label}>
    <div aria-hidden="true" className="brand-loader__mark">Nexnoon<span className="brand-loader__dot">.</span></div>
    <div aria-hidden="true" className="brand-loader__track"><span /></div>
  </div>;
}
