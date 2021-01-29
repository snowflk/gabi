import { useState, useEffect } from 'react';

export default function useWindowDimensions() {

    const hasWindow = typeof window !== 'undefined';

    function getWindowDimensions() {
        const width = hasWindow ? window.innerWidth : null;
        const height = hasWindow ? window.innerHeight : null;
        return {
            width: width,
            height: height,
        };
    }

    const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

    useEffect(() => {
        if (hasWindow) {
            window.addEventListener('resize', function handleResize() {
                    setWindowDimensions(getWindowDimensions());
                }
            );
            return () => window.removeEventListener('resize', function handleResize() {
                    setWindowDimensions(getWindowDimensions());
                }
            );
        }
    }, [hasWindow]);

    return windowDimensions;
}
