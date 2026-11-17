import { useEffect, useRef, useState } from 'react';

// Countdown in seconds. Returns [left, addSeconds, leftRef].
export function useCountdown(total, { running = true, onExpire } = {}) {
  const [left, setLeft] = useState(total);
  const leftRef = useRef(total);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (!running || leftRef.current <= 0) return undefined;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      leftRef.current = Math.max(0, leftRef.current - (now - last) / 1000);
      last = now;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        clearInterval(id);
        expire.current?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const add = (sec) => {
    leftRef.current = Math.max(0, leftRef.current + sec);
    setLeft(leftRef.current);
  };
  return [left, add, leftRef];
}

export function Lives({ lives, max }) {
  return (
    <span className="mg-lives" aria-label={`${lives} lives left`}>
      {Array.from({ length: max }, (_, k) => (
        <span key={k} className={k < lives ? 'mg-heart' : 'mg-heart mg-heart--lost'}>
          ♥
        </span>
      ))}
    </span>
  );
}
