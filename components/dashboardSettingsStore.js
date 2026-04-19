import * as FileSystem from 'expo-file-system/legacy'

const DASHBOARD_SETTINGS_VERSION = 1
const SETTINGS_FILE_NAME = 'dashboard-settings-v1.json'

const getSettingsPath = () => `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${SETTINGS_FILE_NAME}`

const toEncodingOption = () => {
  const encoding = FileSystem?.EncodingType?.UTF8
  if (encoding) return { encoding }
  return {}
}

const withDefaults = (defaults = {}, source = {}) => {
  const safeDefaults = defaults && typeof defaults === 'object' ? defaults : {}
  const safeSource = source && typeof source === 'object' ? source : {}

  return {
    ...safeDefaults,
    ...safeSource,
  }
}

const readDashboardSettings = async (defaults = {}) => {
  const path = getSettingsPath()
  try {
    const info = await FileSystem.getInfoAsync(path)
    if (!info?.exists) {
      return withDefaults(defaults)
    }

    const raw = await FileSystem.readAsStringAsync(path, toEncodingOption())
    const parsed = JSON.parse(raw || '{}')

    if (Number(parsed?.version) !== DASHBOARD_SETTINGS_VERSION) {
      return withDefaults(defaults)
    }

    return withDefaults(defaults, parsed?.dashboardSettings || {})
  } catch (error) {
    console.warn('readDashboardSettings failed', error)
    return withDefaults(defaults)
  }
}

const writeDashboardSettings = async (settings = {}) => {
  const path = getSettingsPath()
  const tempPath = `${path}.tmp`

  const payload = {
    version: DASHBOARD_SETTINGS_VERSION,
    lastUpdated: new Date().toISOString(),
    dashboardSettings: settings,
  }

  try {
    const content = JSON.stringify(payload)
    await FileSystem.writeAsStringAsync(tempPath, content, toEncodingOption())

    const currentInfo = await FileSystem.getInfoAsync(path)
    if (currentInfo?.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true })
    }

    await FileSystem.moveAsync({ from: tempPath, to: path })
    return true
  } catch (error) {
    console.warn('writeDashboardSettings failed', error)
    return false
  }
}

export {
  DASHBOARD_SETTINGS_VERSION,
  readDashboardSettings,
  writeDashboardSettings,
}
