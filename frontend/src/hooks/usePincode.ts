import { useState, useEffect } from 'react';

interface PincodeData {
  city: string;
  state: string;
  loading: boolean;
  error: string | null;
  isValid: boolean;
}

export function usePincode(pincode: string) {
  const [data, setData] = useState<PincodeData>({
    city: '',
    state: '',
    loading: false,
    error: null,
    isValid: false,
  });

  useEffect(() => {
    // Only fetch if exactly 6 digits
    if (!/^\d{6}$/.test(pincode)) {
      setData({ city: '', state: '', loading: false, error: null, isValid: false });
      return;
    }

    let isMounted = true;
    setData(prev => ({ ...prev, loading: true, error: null }));

    fetch(`https://api.postalpincode.in/pincode/${pincode}`)
      .then(res => res.json())
      .then(result => {
        if (!isMounted) return;
        
        if (result && result[0] && result[0].Status === 'Success' && result[0].PostOffice && result[0].PostOffice.length > 0) {
          const postOffice = result[0].PostOffice[0];
          setData({
            city: postOffice.District,
            state: postOffice.State,
            loading: false,
            error: null,
            isValid: true,
          });
        } else {
          setData({
            city: '',
            state: '',
            loading: false,
            error: 'Invalid PIN Code',
            isValid: false,
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setData({
          city: '',
          state: '',
          loading: false,
          error: 'Failed to fetch location details',
          isValid: false,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [pincode]);

  return data;
}
