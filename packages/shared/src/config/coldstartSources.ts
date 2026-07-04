import type { Locale } from '../contracts';

/**
 * 콜드스타트 discovery 화이트리스트 (PLAN #7, docs/spec.md §4.1).
 * 온보딩 프리셋 관심사 key ↔ 소스 매핑. en 소스가 1순위 작성 대상 (F1).
 * 브리핑에 실리기 전 링크 검증을 거치므로 죽은 소스는 자동 교체된다.
 */

export interface ColdstartSource {
  url: string;
  title: string;
  source: string;
  thumbnail_url: string | null;
}

export interface PresetInterest {
  key: string;
  label: Record<Locale, string>;
}

/** 온보딩 관심사 칩 프리셋 12개 — 모바일(M3) 칩과 coldstart 매칭의 공통 key. */
export const PRESET_INTERESTS: PresetInterest[] = [
  { key: 'cooking', label: { en: 'Cooking', ko: '요리' } },
  { key: 'fitness', label: { en: 'Fitness', ko: '운동' } },
  { key: 'tech', label: { en: 'Tech', ko: '테크' } },
  { key: 'design', label: { en: 'Design', ko: '디자인' } },
  { key: 'travel', label: { en: 'Travel', ko: '여행' } },
  { key: 'music', label: { en: 'Music', ko: '음악' } },
  { key: 'reading', label: { en: 'Reading', ko: '책' } },
  { key: 'productivity', label: { en: 'Productivity', ko: '생산성' } },
  { key: 'investing', label: { en: 'Investing', ko: '투자' } },
  { key: 'photography', label: { en: 'Photography', ko: '사진' } },
  { key: 'fashion', label: { en: 'Fashion', ko: '패션' } },
  { key: 'science', label: { en: 'Science', ko: '과학' } },
];

const src = (url: string, title: string, source: string): ColdstartSource => ({
  url,
  title,
  source,
  thumbnail_url: null,
});

export const COLDSTART_SOURCES: Record<string, Record<Locale, ColdstartSource[]>> = {
  cooking: {
    en: [
      src('https://www.seriouseats.com', 'Serious Eats — recipes with the science behind them', 'seriouseats.com'),
      src('https://www.youtube.com/@JKenjiLopezAlt', 'Kenji López-Alt — home cooking, explained', 'YouTube'),
      src('https://www.bonappetit.com', 'Bon Appétit — recipes and food culture', 'bonappetit.com'),
    ],
    ko: [
      src('https://www.youtube.com/@paik_jongwon', '백종원 — 누구나 따라 하는 요리', 'YouTube'),
      src('https://www.10000recipe.com', '만개의레시피 — 한국 최대 레시피 모음', '10000recipe.com'),
      src('https://www.seriouseats.com', 'Serious Eats — 과학으로 풀어내는 요리', 'seriouseats.com'),
    ],
  },
  fitness: {
    en: [
      src('https://www.youtube.com/@JeffNippard', 'Jeff Nippard — science-based training', 'YouTube'),
      src('https://www.nerdfitness.com/blog', 'Nerd Fitness — fitness for regular people', 'nerdfitness.com'),
      src('https://www.youtube.com/@athleanx', 'ATHLEAN-X — training and injury-proofing', 'YouTube'),
    ],
    ko: [
      src('https://www.youtube.com/@GYM_JONGGUK', '김종국 GYM JONG KOOK — 운동 루틴', 'YouTube'),
      src('https://www.youtube.com/@heebab', '힙으뜸 — 홈트와 웨이트 기초', 'YouTube'),
      src('https://www.youtube.com/@JeffNippard', 'Jeff Nippard — 과학 기반 트레이닝', 'YouTube'),
    ],
  },
  tech: {
    en: [
      src('https://www.theverge.com', 'The Verge — technology news and culture', 'theverge.com'),
      src('https://news.ycombinator.com', 'Hacker News — what builders are reading', 'news.ycombinator.com'),
      src('https://www.youtube.com/@mkbhd', 'MKBHD — quality tech reviews', 'YouTube'),
    ],
    ko: [
      src('https://www.youtube.com/@ITSub', '잇섭 — 가장 대중적인 IT 리뷰', 'YouTube'),
      src('https://www.itworld.co.kr', 'ITWorld Korea — IT 뉴스와 트렌드', 'itworld.co.kr'),
      src('https://news.ycombinator.com', 'Hacker News — 만드는 사람들이 읽는 것', 'news.ycombinator.com'),
    ],
  },
  design: {
    en: [
      src('https://www.dezeen.com', 'Dezeen — architecture and design magazine', 'dezeen.com'),
      src('https://www.itsnicethat.com', "It's Nice That — creative inspiration daily", 'itsnicethat.com'),
      src('https://www.designmilk.com', 'Design Milk — modern design finds', 'designmilk.com'),
    ],
    ko: [
      src('https://notefolio.net', '노트폴리오 — 국내 크리에이터 포트폴리오', 'notefolio.net'),
      src('https://www.designsori.com', '디자인소리 — 디자인 뉴스와 어워드', 'designsori.com'),
      src('https://www.itsnicethat.com', "It's Nice That — 매일의 크리에이티브 영감", 'itsnicethat.com'),
    ],
  },
  travel: {
    en: [
      src('https://www.atlasobscura.com', 'Atlas Obscura — the world’s hidden wonders', 'atlasobscura.com'),
      src('https://www.lonelyplanet.com', 'Lonely Planet — guides for every kind of trip', 'lonelyplanet.com'),
      src('https://www.nationalgeographic.com/travel', 'Nat Geo Travel — places worth the journey', 'nationalgeographic.com'),
    ],
    ko: [
      src('https://www.youtube.com/@pani_bottle', '빠니보틀 — 날것의 세계 여행기', 'YouTube'),
      src('https://www.travie.com', '트래비 — 여행 매거진', 'travie.com'),
      src('https://www.atlasobscura.com', 'Atlas Obscura — 세상의 숨은 명소들', 'atlasobscura.com'),
    ],
  },
  music: {
    en: [
      src('https://pitchfork.com', 'Pitchfork — music reviews and discovery', 'pitchfork.com'),
      src('https://www.youtube.com/@nprmusic', 'NPR Tiny Desk — intimate live sessions', 'YouTube'),
      src('https://songexploder.net', 'Song Exploder — how songs get made', 'songexploder.net'),
    ],
    ko: [
      src('https://www.youtube.com/@dingo_music', '딩고 뮤직 — 킬링보이스와 라이브', 'YouTube'),
      src('https://www.youtube.com/@kbskongkam', 'KBS 스페이스 공감 — 깊이 있는 라이브 무대', 'YouTube'),
      src('https://pitchfork.com', 'Pitchfork — 음악 리뷰와 발견', 'pitchfork.com'),
    ],
  },
  reading: {
    en: [
      src('https://lithub.com', 'Literary Hub — the bookish internet, curated', 'lithub.com'),
      src('https://fivebooks.com', 'Five Books — expert picks on every subject', 'fivebooks.com'),
      src('https://www.theparisreview.org', 'The Paris Review — interviews and essays', 'theparisreview.org'),
    ],
    ko: [
      src('https://ch.yes24.com', '채널예스 — 책과 사람 이야기', 'ch.yes24.com'),
      src('https://www.youtube.com/@minumsa', '민음사TV — 편집자들의 책 수다', 'YouTube'),
      src('https://lithub.com', 'Literary Hub — 책의 인터넷을 큐레이션', 'lithub.com'),
    ],
  },
  productivity: {
    en: [
      src('https://nesslabs.com', 'Ness Labs — mindful productivity essays', 'nesslabs.com'),
      src('https://calnewport.com/blog', 'Cal Newport — deep work and focus', 'calnewport.com'),
      src('https://www.youtube.com/@aliabdaal', 'Ali Abdaal — evidence-based productivity', 'YouTube'),
    ],
    ko: [
      src('https://www.youtube.com/@drawandrew', '드로우앤드류 — 일과 성장 이야기', 'YouTube'),
      src('https://publy.co', '퍼블리 — 일하는 사람들의 콘텐츠', 'publy.co'),
      src('https://nesslabs.com', 'Ness Labs — 마음챙김 생산성 에세이', 'nesslabs.com'),
    ],
  },
  investing: {
    en: [
      src('https://awealthofcommonsense.com', 'A Wealth of Common Sense — calm investing', 'awealthofcommonsense.com'),
      src('https://www.investopedia.com', 'Investopedia — finance concepts, explained', 'investopedia.com'),
      src('https://www.morningstar.com', 'Morningstar — fund and stock research', 'morningstar.com'),
    ],
    ko: [
      src('https://www.youtube.com/@3protv', '삼프로TV — 경제와 투자 인사이트', 'YouTube'),
      src('https://www.youtube.com/@syukaworld', '슈카월드 — 경제 이야기 쉽게 풀기', 'YouTube'),
      src('https://uppity.co.kr', '어피티 — 사회초년생 돈 관리 뉴스레터', 'uppity.co.kr'),
    ],
  },
  photography: {
    en: [
      src('https://petapixel.com', 'PetaPixel — photography news and guides', 'petapixel.com'),
      src('https://www.youtube.com/@seantuck', 'Sean Tucker — the philosophy of photography', 'YouTube'),
      src('https://fstoppers.com', 'Fstoppers — tutorials for working photographers', 'fstoppers.com'),
    ],
    ko: [
      src('https://www.youtube.com/@photobyhak', '권학봉 — 사진 조명과 실전 강의', 'YouTube'),
      src('https://www.slrclub.com', 'SLR클럽 — 국내 최대 사진 커뮤니티', 'slrclub.com'),
      src('https://petapixel.com', 'PetaPixel — 사진 뉴스와 가이드', 'petapixel.com'),
    ],
  },
  fashion: {
    en: [
      src('https://www.highsnobiety.com', 'Highsnobiety — style and street culture', 'highsnobiety.com'),
      src('https://www.gq.com', 'GQ — style, grooming, culture', 'gq.com'),
      src('https://www.vogue.com', 'Vogue — fashion at its source', 'vogue.com'),
    ],
    ko: [
      src('https://magazine.musinsa.com', '무신사 매거진 — 스타일과 브랜드 스토리', 'magazine.musinsa.com'),
      src('https://www.vogue.co.kr', '보그 코리아 — 패션의 최전선', 'vogue.co.kr'),
      src('https://hypebeast.kr', '하입비스트 — 스트리트 컬처와 릴리즈', 'hypebeast.kr'),
    ],
  },
  science: {
    en: [
      src('https://www.quantamagazine.org', 'Quanta Magazine — deep science journalism', 'quantamagazine.org'),
      src('https://www.youtube.com/@veritasium', 'Veritasium — an element of truth', 'YouTube'),
      src('https://nautil.us', 'Nautilus — science, connected to life', 'nautil.us'),
    ],
    ko: [
      src('https://www.youtube.com/@ScienceDream', '과학드림 — 과학 이야기의 재미', 'YouTube'),
      src('https://www.youtube.com/@Unrealscience', '안될과학 — 최신 과학 이슈 해설', 'YouTube'),
      src('https://www.dongascience.com', '동아사이언스 — 과학 뉴스', 'dongascience.com'),
    ],
  },
};
