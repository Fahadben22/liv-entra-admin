interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', padding: 2,
        background: checked ? '#22c55e' : '#e2e8f0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .2s', position: 'relative',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.15)', transition: 'transform .2s',
        transform: checked ? 'translateX(-18px)' : 'translateX(0)',
      }} />
    </button>
  );
}
