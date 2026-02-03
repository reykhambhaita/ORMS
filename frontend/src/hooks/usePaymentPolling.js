// src/hooks/usePaymentPolling.js
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import authService from '../screens/authService';

/**
 * Custom hook for polling payment status
 * Implements exponential backoff and handles app state changes
 */
export const usePaymentPolling = () => {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);

  const pollIntervalRef = useRef(null);
  const transactionIdRef = useRef(null);
  const pollCountRef = useRef(0);
  const startTimeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Calculate polling interval with exponential backoff
  const getPollingInterval = (pollCount) => {
    if (pollCount < 15) return 2000;      // 0-30s: Poll every 2 seconds
    if (pollCount < 39) return 5000;      // 30s-2min: Poll every 5 seconds
    return 10000;                         // 2min-5min: Poll every 10 seconds
  };

  // Check if we should stop polling
  const shouldStopPolling = (status, elapsedTime) => {
    // Stop on definitive statuses
    if (['completed', 'failed', 'expired', 'cancelled'].includes(status)) {
      return true;
    }

    // Stop after 5 minutes
    if (elapsedTime > 5 * 60 * 1000) {
      return true;
    }

    return false;
  };

  // Poll payment status
  const pollStatus = async () => {
    if (!transactionIdRef.current) return;

    try {
      const result = await authService.getPaymentStatus(transactionIdRef.current);

      if (result.success) {
        const status = result.data.status;
        setPaymentStatus(result.data);
        setError(null);

        const elapsedTime = Date.now() - startTimeRef.current;

        if (shouldStopPolling(status, elapsedTime)) {
          stopPolling();
        } else {
          // Schedule next poll with backoff
          pollCountRef.current += 1;
          const nextInterval = getPollingInterval(pollCountRef.current);

          pollIntervalRef.current = setTimeout(pollStatus, nextInterval);
        }
      } else {
        setError(result.error || 'Failed to get payment status');
      }
    } catch (err) {
      console.error('Polling error:', err);
      setError(err.message);

      // Retry with backoff on error
      pollCountRef.current += 1;
      const nextInterval = getPollingInterval(pollCountRef.current);
      pollIntervalRef.current = setTimeout(pollStatus, nextInterval);
    }
  };

  // Start polling
  const startPolling = (transactionId) => {
    if (isPolling) {
      console.warn('Polling already in progress');
      return;
    }

    console.log('Starting payment polling for:', transactionId);

    transactionIdRef.current = transactionId;
    pollCountRef.current = 0;
    startTimeRef.current = Date.now();
    setIsPolling(true);
    setError(null);

    // Start immediate poll
    pollStatus();
  };

  // Stop polling
  const stopPolling = () => {
    console.log('Stopping payment polling');

    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setIsPolling(false);
    transactionIdRef.current = null;
    pollCountRef.current = 0;
    startTimeRef.current = null;
  };

  // Reset state
  const reset = () => {
    stopPolling();
    setPaymentStatus(null);
    setError(null);
  };

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume polling if we have a transaction
        if (transactionIdRef.current && !isPolling) {
          console.log('App foregrounded, resuming polling');
          startPolling(transactionIdRef.current);
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - pause polling
        if (isPolling) {
          console.log('App backgrounded, pausing polling');
          if (pollIntervalRef.current) {
            clearTimeout(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    paymentStatus,
    isPolling,
    error,
    startPolling,
    stopPolling,
    reset
  };
};

export default usePaymentPolling;
