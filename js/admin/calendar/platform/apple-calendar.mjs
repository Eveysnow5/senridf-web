import { buildCalendarIcs } from '../ics.mjs';

export function isAppleMobileDevice(navigatorObject = navigator) {
  return (
    /iPhone|iPad|iPod/.test(navigatorObject.userAgent) ||
    (navigatorObject.platform === 'MacIntel' && navigatorObject.maxTouchPoints > 1)
  );
}

export function isStandaloneWebApp(navigatorObject = navigator, mediaQuery = matchMedia) {
  return (
    navigatorObject.standalone === true || mediaQuery('(display-mode: standalone)').matches === true
  );
}

export function openAppleCalendar(rule, exceptions, browser = window) {
  if (!isAppleMobileDevice(browser.navigator)) {
    return { opened: false, reason: 'apple-mobile-required' };
  }

  const ics = buildCalendarIcs(rule, exceptions);
  const url = browser.URL.createObjectURL(
    new browser.Blob([ics], { type: 'text/calendar;charset=utf-8' }),
  );
  browser.location.assign(url);
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 60_000);
  return { opened: true };
}
