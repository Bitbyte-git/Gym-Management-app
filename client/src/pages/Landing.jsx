import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X, Users, CalendarCheck, Dumbbell, CreditCard, ChartNoAxesCombined, BellRing, Globe2, Play, Check, Quote, Building2, UserRoundPlus, Settings2, TrendingUp, Trophy, Smile, Headphones, Flame } from 'lucide-react';
import { Brand } from '../components/Brand';

const features=[
  [Users,'Member management','Profiles, plans and retention in one clean workspace.'],
  [CalendarCheck,'Smart attendance','Instant QR check-ins with live attendance trends.'],
  [Dumbbell,'Workouts & nutrition','Assign programs that keep every member progressing.'],
  [CreditCard,'Payments & billing','Invoices, renewals and dues—completely organized.'],
  [ChartNoAxesCombined,'Reports & insights','Know exactly what is growing your business.'],
  [BellRing,'Automated alerts','Timely reminders that keep your community engaged.']
];
const plans=[
  {name:'Starter',price:'₹999',desc:'For independent studios',items:['Up to 250 members','Core reports','Payments & billing','Email support']},
  {name:'Growth',price:'₹1,999',desc:'For ambitious gyms',popular:true,items:['Up to 1,000 members','Advanced analytics','Workouts & diet plans','Priority support']},
  {name:'Pro',price:'₹4,999',desc:'For large fitness chains',items:['Unlimited Members','All Features','Multi-branch Management','Dedicated Support']}
];

export default function Landing(){
 const nav=useNavigate(); const [open,setOpen]=useState(false);
 const [live,setLive]=useState({checkins:0,revenue:0,members:0});
 const [activeClass,setActiveClass]=useState(0);
 const [selectedCard,setSelectedCard]=useState('');
 const cardProps=id=>({role:'button',tabIndex:0,'aria-pressed':selectedCard===id,onClick:()=>setSelectedCard(v=>v===id?'':id),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedCard(v=>v===id?'':id)}}});
 useEffect(()=>{
   const started=performance.now();
   let frame;
   const animate=now=>{
     const progress=Math.min((now-started)/1300,1);
     const eased=1-Math.pow(1-progress,3);
     setLive({checkins:Math.round(186*eased),revenue:Math.round(248620*eased),members:Math.round(2458*eased)});
     if(progress<1) frame=requestAnimationFrame(animate);
   };
   frame=requestAnimationFrame(animate);
   const pulse=setInterval(()=>setLive(v=>({...v,checkins:v.checkins+1,members:v.members+(Math.random()>.65?1:0)})),6500);
   const classes=setInterval(()=>setActiveClass(v=>(v+1)%3),2800);
   return()=>{cancelAnimationFrame(frame);clearInterval(pulse);clearInterval(classes)};
 },[]);
 const go=()=>nav('/login');
 const register=()=>nav('/register');
 return <div className="landing">
  <header className="nav wrap">
   <Brand onClick={()=>scrollTo(0,0)} subtitle="UNISEX FITNESS STUDIO" size="md"/>
   <nav className={open?'open':''}>{['Solutions','Features','Integrations','Resources','Pricing','Contact'].map(x=><a key={x} href={['Features','Pricing'].includes(x)?'#'+x.toLowerCase():'#features'} onClick={()=>setOpen(false)}>{x}</a>)}</nav>
   <button className="lime-btn desktop" onClick={go}>Start free trial <ArrowRight size={18}/></button>
   <button className="menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  </header>

  <main>
   <section className="hero wrap">
    <div className="hero-copy">
     <p className="eyebrow">PREMIUM UNISEX FITNESS STUDIO</p>
     <h1>BUILT FOR POWER.<br/><em>DESIGNED FOR GROWTH.</em></h1>
     <p className="lead">VINO FITNESS STUDIO empowers athletes and fitness enthusiasts with elite training, state-of-the-art facilities, smart biometric attendance, and seamless memberships.</p>
     <div className="hero-actions"><button className="lime-btn" onClick={go}>Start 14-Day Free Trial <ArrowRight/></button><button className="ghost-btn" onClick={register}>Register as Member <ArrowRight/></button></div>
     <div className="trust-row"><span>Available On :</span><Globe2/><b>Web App</b><span className="platform">◆</span><b>Android</b><span className="platform apple">●</span><b>iOS</b></div>
    </div>
    <div className="hero-visual">
      <img className="hero-man" src="/hero-man.png" alt="Focused Vino Fitness Studio trainer"/>
      <div className={'float-card checkins '+(selectedCard==='checkins'?'is-active':'')} {...cardProps('checkins')}><span className="live-dot"/><small>Today's Check-ins</small><strong>{live.checkins.toLocaleString('en-IN')} <b>↑ 12.4%</b></strong><span>vs yesterday</span><svg className="line-chart" viewBox="0 0 140 38"><polyline points="2,31 13,27 23,30 34,19 45,22 56,13 68,17 79,8 91,15 103,11 115,20 128,8 138,3"/><circle cx="138" cy="3" r="2.5"/></svg></div>
      <div className={'float-card revenue-card '+(selectedCard==='revenue'?'is-active':'')} {...cardProps('revenue')}><span className="live-dot"/><small>Monthly Revenue</small><strong>₹{live.revenue.toLocaleString('en-IN')} <b>↑ 24.5%</b></strong><span>vs last month</span><div className="mini-bars">{[30,54,38,67,45,72,51,81,58,88].map((h,i)=><i key={i} style={{'--bar-height':h+'%','--bar-delay':i*70+'ms'}}/>)}</div></div>
      <div className={'float-card members-card '+(selectedCard==='members'?'is-active':'')} {...cardProps('members')}><span className="live-dot"/><small>TOTAL MEMBERS</small><strong>{live.members.toLocaleString('en-IN')} <b>↑ 18.6%</b></strong><span>vs last month</span><div className="avatars"><i>AM</i><i>IR</i><i>DK</i><i>+</i></div></div>
      <div className={'float-card class-card '+(selectedCard==='classes'?'is-active':'')} {...cardProps('classes')}><small>Upcoming Classes</small><div className={'class-row '+(activeClass===0?'active':'')}><Dumbbell/><span><b>Strength Training</b><small>06:00 AM – 07:00 AM</small></span></div><div className={'class-row '+(activeClass===1?'active':'')}><Users/><span><b>Yoga Flow</b><small>10:00 AM – 11:00 AM</small></span></div><div className={'class-row '+(activeClass===2?'active':'')}><Flame/><span><b>HIIT Blast</b><small>06:00 PM – 07:00 PM</small></span></div><span className="schedule-link">View Full Schedule <ArrowRight/></span></div>
    </div>
   </section>

   <section className="feature-shell wrap" id="features">{features.map(([Icon,t,d])=><article key={t}><Icon/><h3>{t}</h3><p>{d}</p></article>)}</section>
   <section className="proof"><div className="wrap proof-grid">{[[Dumbbell,'5000+','Athletes Trust Vino Fitness'],[Smile,'2.5L+','Workouts Completed'],[CalendarCheck,'10L+','Check-ins Recorded'],[Trophy,'98%','Member Satisfaction']].map(([Icon,n,l])=><div key={n}><Icon/><strong>{n}</strong><span>{l}</span></div>)}</div></section>

   <section className="section wrap how-section" id="how-it-works"><div className="section-head"><h2>HOW IT WORKS</h2></div><div className="steps">{[[Building2,'01','Add Your Gym'],[UserRoundPlus,'02','Bring Members In'],[Settings2,'03','Run & Automate'],[TrendingUp,'04','Grow Your Business']].map(([Icon,n,t],i)=><article key={n}><b>{n}</b><Icon/><h3>{t}</h3><p>{['Set up your gym profile in a few minutes.','Onboard members & assign plans.','Automate daily operations & engage members.','Use insights & reports to scale smarter.'][i]}</p></article>)}</div></section>

   <section className="section price-section" id="pricing"><div className="wrap"><div className="section-head left price-intro"><p className="eyebrow">PRICING</p><h2>Plans That<br/>Power Your Growth.</h2><span className="scribble">↝</span></div><div className="plans">{plans.map(p=><article className={p.popular?'popular':''} key={p.name}>{p.popular&&<span className="tag">MOST POPULAR</span>}<p>{p.name}</p><small>{p.desc}</small><h3>{p.price}<span>/month</span></h3><ul>{p.items.map(x=><li key={x}><Check/> {x}</li>)}</ul><button className={p.popular?'lime-btn':'outline-btn'} onClick={go}>{p.name==='Pro'?'Talk to Sales':'Start Free Trial'} <ArrowRight/></button></article>)}</div></div></section>

   <section className="section wrap stories" id="stories"><div className="section-head left"><p className="eyebrow">LOVED BY OUR MEMBERS</p><h2>Real Stories.<br/>Real Impact.</h2><span className="scribble">〰</span></div><div className="quotes">{[['Rakesh Kumar','Vino Fitness Member','Vino Fitness Studio has transformed my daily routine and helped me reach peak conditioning.'],['Simran Kaur','Fitness Enthusiast','The coaches and facilities at Vino Fitness Studio are top notch. Best fitness decision I have made.'],['Arjun Mehta','Power Lifter','From biometric check-in to workout tracking, everything just flows seamlessly. Love training here.']].map(([n,c,q])=><article key={n}><Quote/><p>{q}</p><div><i>{n.split(' ').map(x=>x[0]).join('')}</i><span><b>{n}</b><small>{c}</small></span></div></article>)}</div></section>
   <section className="cta"><div className="cta-image" aria-hidden="true"/><div className="wrap"><div><h2>Ready to Train at<br/><em>Vino Fitness Studio?</em></h2><p>Join thousands of athletes who push their limits<br/>and build strength with Vino Fitness Studio.</p></div><div className="cta-notes"><span><CalendarCheck/> No Credit Card<br/>Required</span><span><Headphones/> 24/7 Member<br/>Support</span></div><button className="lime-btn" onClick={go}>Start Your Free Trial <ArrowRight/></button></div></section>
  </main>
  <footer className="wrap"><div className="footer-brand"><Brand as="div" size="md" subtitle="UNISEX FITNESS STUDIO"/><p>State-of-the-art unisex fitness studio dedicated to building strength, endurance, and transformation.</p></div><div><b>PRODUCT</b><a href="#features">Features</a><a href="#features">Integrations</a><a href="#pricing">Pricing</a><a href="#">Updates</a></div><div><b>SOLUTIONS</b><a href="#">Gym</a><a href="#">Personal Trainers</a><a href="#">Fitness Studios</a><a href="#">Performance</a></div><div><b>RESOURCES</b><a href="#">Blog</a><a href="#">Guides</a><a href="#">Workouts</a><a href="#">Help Center</a></div><div><b>STUDIO</b><a href="#">About Us</a><a href="#">Trainers</a><a href="mailto:contact@vinofitness.com">Contact Us</a><a href="#">Privacy Policy</a></div><div className="download"><b>DOWNLOAD APP</b><button><Globe2/> Available on<br/><strong>Web App</strong></button></div><small>© 2026 VINO FITNESS STUDIO. All rights reserved.</small></footer>
 </div>
}
