/**
 * Share Extension의 Info.plist에 RCTAsyncStorageAppGroup을 주입한다.
 * 메인 앱과 확장이 같은 App Group AsyncStorage를 봐야 오프라인 캡처 큐가 공유된다
 * (expo-share-extension은 커스텀 Info.plist 키를 확장에 복사하지 않음).
 * expo-share-extension이 withInfoPlist 단계에서 확장 plist를 새로 쓰므로,
 * 모든 mod 이후에 실행되는 finalized 단계에서 파일을 수정한다.
 */
const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.app.rudy.mobile';

module.exports = function withShareExtensionAppGroupStorage(config) {
  return withFinalizedMod(config, [
    'ios',
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const dirs = fs
        .readdirSync(iosRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.endsWith('ShareExtension'));
      for (const dir of dirs) {
        const plistPath = path.join(iosRoot, dir.name, 'Info.plist');
        if (!fs.existsSync(plistPath)) continue;
        let xml = fs.readFileSync(plistPath, 'utf8');
        if (xml.includes('RCTAsyncStorageAppGroup')) continue;
        xml = xml.replace(
          '<dict>',
          `<dict>\n    <key>RCTAsyncStorageAppGroup</key>\n    <string>${APP_GROUP}</string>`,
        );
        fs.writeFileSync(plistPath, xml);
      }
      return cfg;
    },
  ]);
};
