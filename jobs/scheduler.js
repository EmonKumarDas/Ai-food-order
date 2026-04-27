// jobs/scheduler.js — node-cron jobs for alerts + daily reports
const cron = require('node-cron');
const { scanAllProductsForAlerts } = require('../services/alertService');

function startScheduler() {
  // Every hour: check for negative review spikes
  cron.schedule('0 * * * *', () => {
    console.log('⏰ Running hourly alert scan...');
    try {
      const alertsCreated = scanAllProductsForAlerts();
      if (alertsCreated > 0) {
        console.log(`🚨 ${alertsCreated} new alert(s) created.`);
      }
    } catch (err) {
      console.error('Alert scan error:', err);
    }
  });

  // Midnight: log daily report generation
  cron.schedule('0 0 * * *', () => {
    console.log('📊 Midnight: Daily report cache refresh triggered.');
  });

  console.log('📅 Scheduler started — hourly alert scans and midnight reports active.');
}

module.exports = { startScheduler };
