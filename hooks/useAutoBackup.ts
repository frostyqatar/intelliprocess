
import { useEffect, useRef } from 'react';
import { Project } from '../types';
import { exportToJson } from '../services/exportService';

export function useAutoBackup(projects: Project[]) {
  const backupTriggeredToday = useRef(false);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Reset for the next day
      if (hours === 0 && minutes === 0) {
        backupTriggeredToday.current = false;
      }

      // Trigger backup at 18:00 (6 PM)
      if (hours === 18 && !backupTriggeredToday.current) {
        console.log('Auto-backing up all projects...');
        exportToJson(projects, 'auto-backup-all-projects.json');
        backupTriggeredToday.current = true;
      }
    };

    const intervalId = setInterval(checkTime, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [projects]);
}
