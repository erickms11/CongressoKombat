// characters.js - Complete 10-politician roster separated into Ala Esquerda and Ala Direita

export const SIDES = {
  LEFT: 'ALA ESQUERDA',
  RIGHT: 'ALA DIREITA'
};

export const CHARACTERS = [
  // ==================== ALA ESQUERDA ====================
  {
    id: 'lula',
    name: 'Lula',
    side: SIDES.LEFT,
    title: 'O Sindicalista',
    subtitle: 'Companheiro do Povo',
    bio: 'Veterano dos debates e mestre do discurso. Canaliza o poder dos sindicatos e da estrela vermelha para derrotar adversários no carpete.',
    quote: '"Nunca antes na história deste país se viu um golpe desses!"',
    victoryQuote: '"A esperança venceu o medo mais uma vez, companheiros!"',
    portrait: 'assets/portrait_lula.jpg',
    colors: {
      suit: '#1e2433',
      shirt: '#ffffff',
      tie: '#d32f2f',
      hair: '#dcdde1',
      beard: '#c8d6e5',
      skin: '#f5cd79',
      aura: '#e74c3c',
      projectile: '#ff3838'
    },
    stats: { power: 85, speed: 70, defense: 80, special: 95 },
    moves: {
      specialName: 'Estrela Vermelha',
      specialDesc: 'Dispara um projétil flamejante de energia estelar.',
      superName: 'Discurso Sindical',
      superDesc: 'Grito sônico devastador que joga o adversário no plenário.'
    }
  },
  {
    id: 'dilma',
    name: 'Dilma',
    side: SIDES.LEFT,
    title: 'A Coração Valente',
    subtitle: 'Estocadora de Força',
    bio: 'Resistente e destemida. Capaz de invocar rajadas de vento estocado e mandar a mandioca celestial contra qualquer oposição golpista.',
    quote: '"Não acho que quem ganhar ou perder vai ganhar ou perder. Todo mundo vai perder!"',
    victoryQuote: '"Nós saudamos a mandioca e a vitória no plenário!"',
    portrait: 'assets/portrait_dilma.jpg',
    colors: {
      suit: '#c0392b', // Blazer vermelho
      shirt: '#ffffff',
      tie: '#c0392b',
      hair: '#5d4037',
      glasses: '#2c3e50',
      beard: null,
      skin: '#f8c291',
      aura: '#e84118',
      projectile: '#00cec9'
    },
    stats: { power: 88, speed: 68, defense: 92, special: 85 },
    moves: {
      specialName: 'Estocadora de Vento',
      specialDesc: 'Dispara um ciclone turbilhonar de vento concentrado.',
      superName: 'Mandioca Celestial',
      superDesc: 'Meteoro sagrado que cai do teto da câmara causando explosão massiva.'
    }
  },
  {
    id: 'haddad',
    name: 'Haddad',
    side: SIDES.LEFT,
    title: 'O Ministro Taxador',
    subtitle: 'Arrecadador Supremo',
    bio: 'Intelectual da Fazenda. Neutraliza oponentes emitindo boletos em alta velocidade e aplicando taxas alfandegárias implacáveis.',
    quote: '"Essa vitória aqui está devidamente tributada na alíquota correta!"',
    victoryQuote: '"Déficit zero alcançado e oponente derrotado!"',
    portrait: 'assets/portrait_haddad.jpg',
    colors: {
      suit: '#1e272e',
      shirt: '#ffffff',
      tie: '#c0392b',
      hair: '#485460',
      glasses: '#1e272e',
      beard: null,
      skin: '#f5cd79',
      aura: '#9b59b6',
      projectile: '#8e44ad'
    },
    stats: { power: 78, speed: 82, defense: 84, special: 92 },
    moves: {
      specialName: 'Boleto Voador',
      specialDesc: 'Arremessa notas fiscais e boletos tributados que cortam a defesa.',
      superName: 'Remessa Conforme',
      superDesc: 'Chuva de impostos e alíquotas que esmagam o oponente.'
    }
  },
  {
    id: 'boulos',
    name: 'Boulos',
    side: SIDES.LEFT,
    title: 'O Líder Urbano',
    subtitle: 'Voz da Ocupação',
    bio: 'Jovem e ágil nas ruas. Usa o megafone como arma de longo alcance e avança veloz com voadoras de protesto popular.',
    quote: '"Sem teto, sem medo, e sem arrego!"',
    victoryQuote: '"Quem não luta está derrotado! Ocupamos a vitória!"',
    portrait: 'assets/portrait_boulos.jpg',
    colors: {
      suit: '#2f3542',
      shirt: '#b71540',
      tie: '#2f3542',
      hair: '#2c3e50',
      beard: '#1e272e',
      skin: '#f8c291',
      aura: '#eb2f06',
      projectile: '#ff793f'
    },
    stats: { power: 75, speed: 95, defense: 70, special: 85 },
    moves: {
      specialName: 'Megafone Sônico',
      specialDesc: 'Emite ondas de choque acústicas que atordoam o adversário.',
      superName: 'Ocupação Relâmpago',
      superDesc: 'Corrida supersônica com voadora dupla incendiária.'
    }
  },
  {
    id: 'jones',
    name: 'Jones Manoel',
    side: SIDES.LEFT,
    title: 'O Teórico Revolucionário',
    subtitle: 'Marxista Dialético',
    bio: 'Historiador e professor incisivo. Golpes precisos fundamentados na teoria revolucionária, arremessando livros clássicos com impacto soviético.',
    quote: '"A história de todas as sociedades é a luta de classes... e de socos!"',
    victoryQuote: '"Vitória da vanguarda popular sobre o reacionarismo!"',
    portrait: 'assets/portrait_jones.jpg',
    colors: {
      suit: '#8b0000', // Jaqueta vinho/vermelha
      shirt: '#1e272e',
      tie: '#8b0000',
      hair: '#111111',
      beard: '#111111',
      glasses: '#222222',
      skin: '#5c3a21', // pele negra
      aura: '#d63031',
      projectile: '#e17055'
    },
    stats: { power: 84, speed: 85, defense: 76, special: 90 },
    moves: {
      specialName: 'Tomo da Teoria',
      specialDesc: 'Arremessa um livro pesado de materialismo que atordoa o inimigo.',
      superName: 'Revolução Dialética',
      superDesc: 'Sequência de golpes com ondas de choque de foice e martelo.'
    }
  },

  // ==================== ALA DIREITA ====================
  {
    id: 'bolsonaro',
    name: 'Bolsonaro',
    side: SIDES.RIGHT,
    title: 'O Capitão',
    subtitle: 'Comandante da Bancada',
    bio: 'Enérgico e combativo. Dispara rajadas duplas de arminha com as mãos e executa avanços rápidos com estilo de motociata.',
    quote: '"É melhor o adversário ir se acostumando, taokey?!"',
    victoryQuote: '"Brasil acima de tudo! Missão dada é missão cumprida!"',
    portrait: 'assets/portrait_bolsonaro.jpg',
    colors: {
      suit: '#1e272e',
      shirt: '#ffffff',
      tie: '#27ae60', // verde
      hair: '#576574',
      beard: null,
      skin: '#f3a683',
      aura: '#f1c40f',
      projectile: '#f5cd79'
    },
    stats: { power: 90, speed: 75, defense: 75, special: 90 },
    moves: {
      specialName: 'Disparo da Arminha',
      specialDesc: 'Dois projéteis rápidos de energia apontados diretamente ao adversário.',
      superName: 'Motociata Rush',
      superDesc: 'Avanço com capacete e rastro de fumaça dourada atropelando a bancada.'
    }
  },
  {
    id: 'tarcisio',
    name: 'Tarcísio',
    side: SIDES.RIGHT,
    title: 'O Homem do Asfalto',
    subtitle: 'Engenheiro de Concessões',
    bio: 'Focado em infraestrutura pesada. Utiliza seu capacete de obra e a lendária martelada do leilão que estremece a terra.',
    quote: '"Vamos bater o martelo e entregar essa obra!"',
    victoryQuote: '"Concessão concluída com sucesso! Menos impostos, mais asfalto!"',
    portrait: 'assets/portrait_tarcisio.jpg',
    colors: {
      suit: '#0c2461',
      shirt: '#ffffff',
      tie: '#1e3799',
      hair: '#1e272e',
      beard: null,
      helmet: '#ffffff',
      skin: '#f8a5c2',
      aura: '#fa983a',
      projectile: '#e58e26'
    },
    stats: { power: 95, speed: 65, defense: 90, special: 80 },
    moves: {
      specialName: 'Martelada do Leilão',
      specialDesc: 'Bate o martelo criando uma onda de choque de detritos e asfalto no chão.',
      superName: 'Rolo Compressor',
      superDesc: 'Impacto blindado de peso pesado que esmaga qualquer bloqueio.'
    }
  },
  {
    id: 'nikolas',
    name: 'Nikolas Ferreira',
    side: SIDES.RIGHT,
    title: 'O Tribuno da Internet',
    subtitle: 'Fenômeno das Redes',
    bio: 'Jovem e explosivo nos discursos. Converte engajamento digital e polêmicas do plenário em ataques sonoros de velocidade impressionante.',
    quote: '"Pode espernear à vontade, a verdade não tem filtro!"',
    victoryQuote: '"Mais uma lacração destruída com argumentos e direitos!"',
    portrait: 'assets/portrait_nikolas.jpg',
    colors: {
      suit: '#1e3799', // Terno azul vibrante
      shirt: '#ffffff',
      tie: '#f1c40f',
      hair: '#3d2b1f',
      beard: null,
      skin: '#f5cd79',
      aura: '#3498db',
      projectile: '#00d2d3'
    },
    stats: { power: 80, speed: 96, defense: 72, special: 92 },
    moves: {
      specialName: 'Disparo de Notificação',
      specialDesc: 'Projétil em feixe de likes flamejantes e posts virais.',
      superName: 'Discurso em 2x',
      superDesc: 'Sequência frenética em velocidade dobrada com microfone de ouro.'
    }
  },
  {
    id: 'flavio',
    name: 'Flávio Bolsonaro',
    side: SIDES.RIGHT,
    title: 'O Senador Zero Um',
    subtitle: 'Estrategista da Família',
    bio: 'Articulador experiente de bastidores. Arremessa caixas de trufas douradas explosivas e se protege com uma defesa blindada luxuosa.',
    quote: '"Tudo dentro da legalidade e devidamente auditado!"',
    victoryQuote: '"Quem tem patrimônio sólido vence qualquer debate!"',
    portrait: 'assets/portrait_flavio.jpg',
    colors: {
      suit: '#192a56',
      shirt: '#ffffff',
      tie: '#fbc531',
      hair: '#2f3640',
      beard: null,
      skin: '#f7d794',
      aura: '#e1b12c',
      projectile: '#cd853f'
    },
    stats: { power: 82, speed: 76, defense: 88, special: 88 },
    moves: {
      specialName: 'Bombom Kopenhagen',
      specialDesc: 'Arremessa caixas de chocolates e moedas douradas explosivas.',
      superName: 'Mansão Blindada',
      superDesc: 'Cria uma muralha de luxo e contra-ataca com chuva de cheques.'
    }
  },
  {
    id: 'campopiano',
    name: 'Eduarda Campopiano',
    side: SIDES.RIGHT,
    title: 'A Voz Conservadora',
    subtitle: 'Articuladora da Juventude',
    bio: 'Firme e contundente em suas pautas. Usa oratória ágil, presença de palco e argumentos afiados para encurralar qualquer rival no plenário.',
    quote: '"Não vamos recuar um milímetro em defesa dos nossos valores e da liberdade!"',
    victoryQuote: '"Debate vencido com coerência, coragem e apoio da juventude!"',
    portrait: 'assets/portrait_campopiano.jpg',
    colors: {
      suit: '#192a56', // Blazer azul escuro elegante
      shirt: '#ffffff',
      tie: '#2ecc71',
      hair: '#2c1e1a', // Cabelo castanho escuro longo
      beard: null,
      skin: '#f7d794',
      aura: '#00cec9',
      projectile: '#0984e3'
    },
    stats: { power: 84, speed: 92, defense: 77, special: 89 },
    moves: {
      specialName: 'Discurso Inflamado',
      specialDesc: 'Dispara ondas sonoras e argumentos afiados que quebram a guarda.',
      superName: 'Manifesto da Juventude',
      superDesc: 'Invoca uma onda verde-amarela de apoio popular que arremessa o rival no plenário.'
    }
  }
];

export function getCharacterById(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}
