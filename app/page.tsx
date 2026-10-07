'use client'

import { useState } from 'react'
import {
  ArrowRight,
  AudioWaveform,
  Award,
  BadgeCheck,
  BadgePercent,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Droplets,
  Crown,
  Feather,
  Flower2,
  Gift,
  GraduationCap,
  HeartHandshake,
  Layers,
  MapPin,
  Menu,
  MessageCircle,
  PersonStanding,
  Phone,
  Rocket,
  Ruler,
  ScanFace,
  ShieldCheck,
  Smile,
  Star,
  Syringe,
  Target,
  TrendingUp,
  User,
  Users,
  Waves,
  X,
  Zap,
} from 'lucide-react'

const results = [
  { icon: Ruler, title: 'Redução de medidas', text: 'Diminuição da gordura localizada e das medidas.' },
  { icon: Waves, title: 'Mais firmeza e elasticidade', text: 'Pele mais firme, com menos aspecto de flacidez.' },
  { icon: PersonStanding, title: 'Contorno definido', text: 'Cintura e silhueta mais harmoniosas.' },
  { icon: Flower2, title: 'Autoestima e bem-estar', text: 'Mais confiança para se sentir bem com o seu corpo.' },
]

const resultCases = [
  { id: 'cliente-1', label: 'Cliente 1 · Modelagem corporal · vista lateral', pairs: [1, 2] },
  { id: 'cliente-2', label: 'Cliente 2 · Modelagem corporal · vista frontal e lateral', pairs: [3, 4] },
]

const sealPoints = Array.from({ length: 64 }, (_, i) => {
  const angle = (i / 64) * Math.PI * 2
  const radius = i % 2 === 0 ? 100 : 92
  return `${(100 + radius * Math.cos(angle)).toFixed(1)},${(100 + radius * Math.sin(angle)).toFixed(1)}`
}).join(' ')

const academyPillars = [
  { icon: ShieldCheck, title: 'Segurança', text: 'Protocolos e parâmetros ajustados para cada tipo de pele.' },
  { icon: Target, title: 'Resultados', text: 'Tratamento indicado a partir da análise de cada paciente.' },
  { icon: Users, title: 'Equipe especializada', text: 'Profissionais formadas na prática e na teoria.' },
]

const maleLaserBenefits = [
  { icon: ShieldCheck, title: 'Mais confiança' },
  { icon: Clock3, title: 'Resultados duradouros' },
  { icon: Droplets, title: 'Pele mais lisa e macia' },
  { icon: Feather, title: 'Procedimento seguro e confortável' },
  { icon: User, title: 'Ideal para todas as regiões do corpo' },
]

const facialLaserBenefits = [
  { icon: Droplets, title: 'Pele mais lisa e uniforme' },
  { icon: Zap, title: 'Redução de pelos' },
  { icon: ShieldCheck, title: 'Mais conforto no dia a dia' },
  { icon: TrendingUp, title: 'Resultados visíveis' },
]

const vipGroupLink = 'https://chat.whatsapp.com/BZ2Dyvvzd5b6swl45HMh6U'

const vipBenefits = [
  { icon: BadgePercent, title: 'Condições especiais de tratamento' },
  { icon: Gift, title: 'Sorteios relâmpago' },
  { icon: Rocket, title: 'Lançamentos de protocolos' },
  { icon: CalendarClock, title: 'Vagas antecipadas' },
  { icon: Star, title: 'Atendimento prioritário' },
]

const courseHighlights = [
  { icon: GraduationCap, title: 'Treinamento completo' },
  { icon: Award, title: 'Padrão Zafine de qualidade' },
  { icon: ShieldCheck, title: 'Segurança e confiança' },
]

const courseStrip = [
  { icon: BadgeCheck, title: 'Profissionais capacitadas' },
  { icon: Zap, title: 'Tecnologia de ponta' },
  { icon: HeartHandshake, title: 'Atendimento humanizado' },
  { icon: TrendingUp, title: 'Resultados incríveis' },
]

const whatsappLink = 'https://wa.me/5548991074845?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20Zafine%20e%20quero%20agendar%20uma%20avalia%C3%A7%C3%A3o.'

const services = [
  { icon: Zap, title: 'Depilação a laser', text: 'Nossa especialidade: tecnologia avançada para reduzir os pelos com segurança, conforto e resultados duradouros.' },
  { icon: PersonStanding, title: 'Estética corporal', text: 'Protocolos para modelar o corpo, reduzir medidas e valorizar o seu contorno.' },
  { icon: Waves, title: 'Flacidez', text: 'Tratamentos que estimulam o colágeno para uma pele mais firme e com mais sustentação.' },
  { icon: Layers, title: 'Estrias', text: 'Técnicas que melhoram a textura e a aparência das estrias, deixando a pele mais uniforme.' },
  { icon: ScanFace, title: 'Rejuvenescimento facial', text: 'Cuidados para suavizar linhas, devolver o viço e renovar a pele do rosto.' },
  { icon: Syringe, title: 'Lipo enzimática', text: 'Aplicação de enzimas que ajudam a reduzir a gordura localizada, sem cirurgia.' },
  { icon: AudioWaveform, title: 'Radiofrequência', text: 'Calor controlado que firma a pele, melhora o contorno e ativa a produção de colágeno.' },
  { icon: Smile, title: 'Lipo de papada', text: 'Redução da gordura sob o queixo para um contorno facial mais definido.' },
]

const faqs = [
  ['Como funciona a depilação a laser?', 'A luz do laser é absorvida pelo pigmento do pelo e aquece o folículo, reduzindo progressivamente o crescimento. O procedimento é rápido e feito com acompanhamento profissional.'],
  ['Quantas sessões são necessárias?', 'O número varia de acordo com a região, espessura dos pelos e características de cada pessoa. Na avaliação, explicamos um plano personalizado para você.'],
  ['O procedimento dói?', 'A tecnologia utilizada conta com recursos para tornar a experiência mais confortável. A sensação costuma ser rápida e bem tolerada.'],
  ['Posso fazer laser no verão?', 'Sim. Com os cuidados corretos e orientação da equipe, o tratamento pode ser realizado o ano todo.'],
  ['A avaliação é gratuita?', 'Sim. Fale com nossa equipe pelo WhatsApp para entender o tratamento indicado e consultar as condições atuais.'],
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label"><span />{children}</p>
}

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const closeMenu = () => setMenuOpen(false)

  return (
    <main>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#inicio" className="brand" aria-label="Zafine — início">
            <span className="brand-mark" aria-hidden="true">Z</span>
            <span><strong>Zafine</strong><small>CLÍNICA ESTÉTICA AVANÇADA</small></span>
          </a>
          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
            <a href="#sobre" onClick={closeMenu}>Sobre nós</a>
            <a href="#servicos" onClick={closeMenu}>Tratamentos</a>
            <a href="#universidade" onClick={closeMenu}>Universidade do Laser</a>
            <a href="#depoimentos" onClick={closeMenu}>Experiências</a>
            <a href="#contato" onClick={closeMenu}>Contato</a>
            <a href={whatsappLink} className="nav-cta mobile-cta" target="_blank" rel="noreferrer" onClick={closeMenu}>Agendar avaliação <ArrowRight size={16} /></a>
          </nav>
          <a href={whatsappLink} className="nav-cta desktop-cta" target="_blank" rel="noreferrer">Agendar avaliação <ArrowRight size={16} /></a>
          <button className="menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section id="inicio" className="hero">
        <div className="hero-image" role="img" aria-label="Sala de atendimento da Zafine com equipamento de depilação a laser" />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> Beleza também é liberdade</p>
            <h1>Uma nova relação com a sua pele.</h1>
            <p className="hero-text">Depilação a laser com tecnologia, acolhimento e cuidado para você viver mais leve — todos os dias.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={whatsappLink} target="_blank" rel="noreferrer">Quero minha avaliação <ArrowRight size={18} /></a>
              <a className="text-link light" href="#servicos">Conheça nossos tratamentos <ArrowRight size={16} /></a>
            </div>
            <div className="hero-proof"><div className="stars">★★★★★</div><span><strong>4,8</strong> no Google · 70 avaliações</span></div>
          </div>
          <div className="award-seal" role="img" aria-label="Zafine: 4 vezes premiada por qualidade em atendimento">
            <svg viewBox="0 0 200 200" aria-hidden="true"><polygon points={sealPoints} /></svg>
            <div className="award-seal-inner">
              <span className="award-stars">★ ★ ★</span>
              <strong>4x</strong>
              <span className="award-text">premiada por qualidade em atendimento</span>
              <span className="award-stars">★ ★ ★</span>
            </div>
          </div>
        </div>
        <div className="scroll-hint"><span />Role para descobrir</div>
      </section>

      <section className="trust-strip"><div className="container trust-grid"><div><strong>+130 mil</strong><span>clientes atendidos</span></div><div><strong>4,8</strong><span>avaliação no Google</span></div><div><strong>9 anos</strong><span>referência em depilação a laser</span></div><div><strong>12x</strong><span>condições especiais</span></div></div></section>

      <section id="sobre" className="section about-section"><div className="container about-grid"><div className="about-visual"></div><div className="about-copy"><SectionLabel>Sobre a Zafine</SectionLabel><h2>Mais do que estética. <em>É cuidar de você por inteiro.</em></h2><p>A Zafine nasceu para transformar cada cuidado com a sua pele e o seu corpo em uma experiência de bem-estar, confiança e autoestima. Da depilação a laser aos tratamentos faciais e corporais, cada detalhe foi pensado para você se sentir acolhida desde o primeiro contato.</p><p>Unimos profissionais treinadas, tecnologia avançada e um atendimento próximo para entregar resultados que você vê e sente — em um só lugar, sem complicação. São 9 anos como referência em depilação a laser em Sombrio e mais de 130 mil clientes atendidos.</p><a className="text-link" href={whatsappLink} target="_blank" rel="noreferrer">Conheça a Zafine <ArrowRight size={16} /></a></div></div></section>

      <section id="servicos" className="section services-section"><div className="container"><div className="section-heading"><div><SectionLabel>Nossos cuidados</SectionLabel><h2>Seu momento de <em>se cuidar.</em></h2></div><p>Da depilação a laser, nossa especialidade, aos tratamentos corporais e faciais: tudo o que você precisa em um só lugar.</p></div><div className="services-grid">{services.map(({ icon: Icon, title, text }) => <article className="service-card" key={title}><div className="service-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p><a href={whatsappLink} target="_blank" rel="noreferrer" aria-label={`Saiba mais sobre ${title}`}><ArrowRight size={18} /></a></article>)}</div></div></section>

      <section className="difference-section"><div className="container difference-grid"><div><SectionLabel>Por que a Zafine?</SectionLabel><h2>Resultado que você sente. <em>Confiança que você vê.</em></h2><p className="difference-intro">A gente acredita que cuidar de si não precisa ser complicado. Por isso, criamos uma experiência simples, segura e feita para caber na sua vida.</p><ul className="check-list"><li><span><Check size={15} /></span><div><strong>Profissionais treinadas</strong><p>Conhecimento e atenção em cada sessão.</p></div></li><li><span><Check size={15} /></span><div><strong>Tecnologia avançada</strong><p>Equipamentos modernos para mais conforto.</p></div></li><li><span><Check size={15} /></span><div><strong>Atendimento humano</strong><p>Você é ouvida, respeitada e acolhida.</p></div></li></ul></div><div className="results-info"><span className="results-kicker">Resultados reais</span><h3>Modelagem corporal</h3><p>Protocolo personalizado que trabalha gordura localizada, flacidez e contorno do corpo, combinando tecnologia e técnicas manuais de acordo com a avaliação de cada cliente.</p><ul className="results-benefits">{results.map(({ icon: Icon, title, text }) => <li key={title}><span><Icon size={17} /></span><div><strong>{title}</strong><small>{text}</small></div></li>)}</ul></div></div><div className="container results-grid">{resultCases.map(({ id, label, pairs }) => <figure className="results-card" key={id}><div className="results-photos">{pairs.map((n) => <div className="results-pair" key={n}><div><img src={`/resultados/modelagem-${n}-antes.jpg`} alt={`Antes da modelagem corporal — ${label}`} loading="lazy" /><span>Antes</span></div><div><img src={`/resultados/modelagem-${n}-depois.jpg`} alt={`Depois da modelagem corporal — ${label}`} loading="lazy" /><span className="after">Depois</span></div></div>)}</div><figcaption>{label}</figcaption></figure>)}</div><p className="container results-note">Fotos de clientes reais da Zafine, publicadas com autorização. Os resultados variam de pessoa para pessoa.</p></section>

      <section id="universidade" className="academy-section"><div className="container academy-grid"><figure className="academy-visual"><img src="/universidade-do-laser.jpg" alt="Profissional da Zafine realizando aplicação de laser no pescoço de uma cliente usando óculos de proteção" loading="lazy" /><figcaption className="academy-badge"><span><GraduationCap size={20} /></span><div><small>Rede Zafine</small><strong>9 anos</strong></div></figcaption></figure><div className="academy-copy"><p className="eyebrow"><span className="eyebrow-line" /> Beleza também é conhecimento</p><h2>O que é a <em>Universidade do Laser</em></h2><p>Um método de curso desenvolvido pela Zafine para aperfeiçoar as profissionais que realizam as aplicações de laser.</p><p>Com treinamentos práticos e teóricos, as profissionais se especializam para analisar cada paciente e determinar o melhor tratamento de laser para ela.</p><ul className="academy-pillars">{academyPillars.map(({ icon: Icon, title, text }) => <li key={title}><span><Icon size={19} /></span><strong>{title}</strong><small>{text}</small></li>)}</ul></div></div></section>

      <section className="course-section"><div className="container academy-course"><div className="academy-course-copy"><span className="results-kicker">Curso próprio Zafine</span><h3>A Zafine tem curso próprio para as profissionais que <em>aplicam a depilação a laser.</em></h3><ul className="academy-course-list">{courseHighlights.map(({ icon: Icon, title }) => <li key={title}><span><Icon size={20} /></span>{title}</li>)}</ul><div className="academy-formula"><strong>Tecnologia + conhecimento = <em>resultados reais</em></strong><p>Investimos em conhecimento para entregar o que há de melhor em depilação a laser para você.</p></div></div><figure className="academy-course-visual"><img src="/curso-proprio.jpg" alt="Profissional da Zafine com óculos de proteção aplicando depilação a laser na perna de uma cliente" loading="lazy" /><figcaption>Mais que estética, <em>é conhecimento.</em></figcaption></figure><ul className="academy-strip">{courseStrip.map(({ icon: Icon, title }) => <li key={title}><span><Icon size={22} /></span>{title}</li>)}</ul></div></section>

      <section className="academy-section academy-results"><div className="container male-laser"><div className="male-laser-copy"><span className="results-kicker">Depilação a laser facial</span><h3>Sua melhor versão, <em>sem imperfeições.</em></h3><p>A depilação a laser facial proporciona uma pele mais lisa, uniforme e livre de pelos, com mais conforto e autoestima no dia a dia.</p><ul className="male-laser-benefits">{facialLaserBenefits.map(({ icon: Icon, title }) => <li key={title}><span><Icon size={16} /></span>{title}</li>)}</ul><a className="button button-primary" href={whatsappLink} target="_blank" rel="noreferrer"><CalendarCheck size={17} /> Agende sua avaliação</a></div><figure className="results-card facial-laser-photos"><div className="results-pair"><div><img src="/resultados/laser-facial-1-sessao.jpg" alt="Rosto masculino de perfil com barba, na 1ª sessão de depilação a laser" loading="lazy" /><span>1ª sessão</span></div><div><img src="/resultados/laser-facial-10-sessao.jpg" alt="Rosto masculino de perfil sem barba, na 10ª sessão de depilação a laser" loading="lazy" /><span className="after">10ª sessão</span></div></div><figcaption>Depilação a laser facial · barba</figcaption></figure></div><div className="container male-laser"><div className="male-laser-copy"><span className="results-kicker">Depilação a laser masculina</span><h3>Mais que estética, <em>é liberdade.</em></h3><p>Acabe com os pelos indesejados e tenha uma pele mais lisa, limpa e bem cuidada. Conforto, praticidade e resultados duradouros.</p><ul className="male-laser-benefits">{maleLaserBenefits.map(({ icon: Icon, title }) => <li key={title}><span><Icon size={16} /></span>{title}</li>)}</ul><a className="button button-primary" href={whatsappLink} target="_blank" rel="noreferrer"><CalendarCheck size={17} /> Agende sua avaliação</a></div><figure className="results-card male-laser-photos"><div className="results-pair"><div><img src="/resultados/laser-masculino-antes.jpg" alt="Costas masculinas com pelos, antes da depilação a laser" loading="lazy" /><span>Antes</span></div><div><img src="/resultados/laser-masculino-depois.jpg" alt="Costas masculinas lisas, depois da depilação a laser" loading="lazy" /><span className="after">Depois</span></div></div><figcaption>Depilação a laser masculina · costas</figcaption></figure></div></section>

      <section id="depoimentos" className="section testimonials-section"><div className="container"><div className="section-heading centered"><SectionLabel>Quem vive, recomenda</SectionLabel><h2>Histórias que fazem <em>bem.</em></h2></div><div className="testimonial-grid"><article className="testimonial-card featured"><div className="quote-mark">“</div><p>O atendimento é impecável! As profissionais explicam tudo com calma e passam muita confiança. O resultado ficou simplesmente perfeito.</p><div className="testimonial-author"><span className="avatar">KC</span><div><strong>Kauane C.</strong><small>Cliente Zafine · Google</small></div><div className="stars">★★★★★</div></div></article><article className="testimonial-card"><div className="stars">★★★★★</div><p>As meninas são super atenciosas e sempre me lembram do meu horário. Faço o tratamento há mais de um ano e não tenho o que reclamar.</p><div className="testimonial-author"><span className="avatar peach">JN</span><div><strong>Jessica N.</strong><small>Cliente Zafine · Google</small></div></div></article><article className="testimonial-card"><div className="stars">★★★★★</div><p>Atendimento maravilhoso, equipe nota 1000 e aparelhos de última geração. Recomendo de olhos fechados!</p><div className="testimonial-author"><span className="avatar blue">NM</span><div><strong>Nicole M.</strong><small>Cliente Zafine · Google</small></div></div></article></div></div></section>

      <section id="grupo-vip" className="vip-section"><div className="container vip-card"><div className="vip-copy"><span className="vip-tag"><Crown size={14} /> Grupo VIP Zafine</span><h2>Já pensou em receber promoções exclusivas <em>antes de todo mundo?</em></h2><p>O nosso Grupo VIP no WhatsApp foi feito pra isso. É gratuito, e você fica sabendo das novidades da Zafine em primeira mão.</p><a className="button button-primary" href={vipGroupLink} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Entrar no Grupo VIP</a></div><div className="vip-benefits"><p>O que você encontra no grupo</p><ul>{vipBenefits.map(({ icon: Icon, title }) => <li key={title}><span><Icon size={17} /></span>{title}</li>)}</ul><strong>Tudo isso e muito mais!</strong></div></div></section>

      <section className="faq-section"><div className="container faq-grid"><div className="faq-intro"><SectionLabel>Tem alguma dúvida?</SectionLabel><h2>Tudo para você se sentir <em>segura.</em></h2><p>Se ainda ficou alguma pergunta, fale com nossa equipe. Estamos prontas para te orientar.</p><a className="button button-dark" href={whatsappLink} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a Zafine</a></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={18} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></div></section>

      <section className="final-cta"><div className="container final-cta-inner"><div><p className="eyebrow"><span className="eyebrow-line" /> Seu próximo passo</p><h2>Mais liberdade para viver<br /><em>do seu jeito.</em></h2></div><a className="button button-light" href={whatsappLink} target="_blank" rel="noreferrer">Agendar minha avaliação <ArrowRight size={18} /></a></div></section>

      <section id="contato" className="contact-section"><div className="container contact-grid"><div><SectionLabel>Onde estamos</SectionLabel><h2>Vem viver a experiência <em>Zafine.</em></h2><p>Estamos esperando por você em um espaço pensado para acolher, cuidar e transformar sua rotina.</p><div className="contact-details"><a href="tel:+5548991074845"><span><Phone size={17} /></span><div><small>Telefone e WhatsApp</small><strong>(48) 99107-4845</strong></div></a><div><span><MapPin size={17} /></span><div><small>Endereço</small><strong>Av. Papa João XXIII, 833<br />São Luiz · Sombrio, SC</strong></div></div><div><span><Clock3 size={17} /></span><div><small>Horário de atendimento</small><strong>Seg a sáb · 8h às 23h30</strong></div></div></div></div><div className="map-card"><div className="map-pattern" /><MapPin className="map-pin" size={34} /><div className="map-label"><strong>Zafine Clínica Estética Avançada</strong><span>São Luiz, Sombrio — SC</span></div><a href="https://maps.google.com/?q=Zafine+Depilação+Sombrio" target="_blank" rel="noreferrer" className="map-button">Abrir no Google Maps <ArrowRight size={15} /></a></div></div></section>

      <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-about">
            <a href="#inicio" className="brand footer-brand"><span className="brand-mark" aria-hidden="true">Z</span><span><strong>Zafine</strong><small>CLÍNICA ESTÉTICA AVANÇADA</small></span></a>
            <p className="footer-tagline">Beleza também é <em>liberdade.</em></p>
            <p className="footer-desc">Há 9 anos referência em depilação a laser em Sombrio, com mais de 130 mil clientes atendidos.</p>
            <div className="footer-social">
              <a href="https://www.instagram.com/zafine.sombrio/" aria-label="Instagram" target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg></a>
              <a href={whatsappLink} aria-label="WhatsApp" target="_blank" rel="noreferrer"><MessageCircle size={17} /></a>
              <a href="tel:+5548991074845" aria-label="Telefone"><Phone size={17} /></a>
            </div>
          </div>
          <nav className="footer-col" aria-label="Rodapé">
            <h4>Navegue</h4>
            <a href="#sobre">Sobre nós</a>
            <a href="#servicos">Tratamentos</a>
            <a href="#universidade">Universidade do Laser</a>
            <a href="#depoimentos">Experiências</a>
            <a href="#grupo-vip">Grupo VIP</a>
          </nav>
          <div className="footer-col">
            <h4>Contato</h4>
            <a href="tel:+5548991074845">(48) 99107-4845</a>
            <span>Av. Papa João XXIII, 833<br />São Luiz · Sombrio, SC</span>
            <span>Seg a sáb · 8h às 23h30</span>
          </div>
          <div className="footer-col footer-cta">
            <h4>Agende sua avaliação</h4>
            <p>Fale com a nossa equipe e descubra o melhor tratamento para você.</p>
            <a className="button button-light" href={whatsappLink} target="_blank" rel="noreferrer">Falar no WhatsApp <ArrowRight size={16} /></a>
          </div>
        </div>
        <div className="container footer-bottom"><span>© 2026 Zafine Clínica Estética Avançada. Todos os direitos reservados.</span><span>Feito com cuidado em Sombrio, SC</span></div>
      </footer>
      <a className="whatsapp-float" href={whatsappLink} target="_blank" rel="noreferrer" aria-label="Falar com a Zafine pelo WhatsApp"><MessageCircle size={25} /></a>
    </main>
  )
}

