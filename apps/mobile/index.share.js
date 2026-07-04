// iOS Share Extension 엔트리 (expo-share-extension) — 메인 앱과 별도 RN 루트.
import { AppRegistry } from 'react-native';
import ShareExtension from './share/ShareExtension';

AppRegistry.registerComponent('shareExtension', () => ShareExtension);
