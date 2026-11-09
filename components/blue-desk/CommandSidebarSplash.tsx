import styles from "./CommandSidebarSplash.module.css";

/**
 * Original geometric cyberpunk backdrop for the shared navigation rail.
 * Purely decorative: no text/data overlays, off-site assets or user tracking.
 */
export default function CommandSidebarSplash(){
  return <div className={styles.splash} aria-hidden="true"
    data-bluebelly-sidebar-splash="vector-ambient-art">
    <svg className={styles.art} viewBox="0 0 260 450"
      preserveAspectRatio="xMidYMid slice" focusable="false">
      <g className={styles.circuit} fill="none" strokeWidth="1">
        <path d="M-18 72H76L97 94H173M-25 382H54L77 359H195M-8 122H42L60 139H119M141 414H219L240 394H281"/>
        <path d="M29 20V92L43 106V164M214 112V173L197 190V253M82 319V383L62 403V456"/>
      </g>
      <g className={styles.horizon} fill="none">
        <circle cx="127" cy="253" r="113" strokeDasharray="5 10"/>
        <circle cx="127" cy="253" r="85" strokeDasharray="64 10 12 5"/>
        <circle cx="127" cy="253" r="55"/>
        <path d="M-18 253H283M127 108V402M42 169L214 341M213 167L43 339"/>
      </g>
      <g className={styles.splashFills}>
        <path d="M-25 339L79 170L60 236L224 68L165 203L285 166L176 297L215 264L82 416L117 315Z"/>
        <path d="M8 385L96 291L81 359L160 294L123 407L180 372L91 474Z"/>
        <path d="M161 123L237 40L212 104L270 77L239 141Z"/>
      </g>
      <g className={styles.slashes} fill="none" strokeWidth="2">
        <path d="M-3 314L146 157M35 365L195 199M78 381L231 228"/>
        <path d="M61 195L211 87M141 357L263 231"/>
      </g>
      <g className={styles.sparks}>
        <path d="M24 224h16m-8-8v16M203 309h13m-6.5-6.5v13M185 117h12m-6-6v12"/>
        <circle cx="40" cy="137" r="2.4"/><circle cx="241" cy="218" r="2.7"/>
        <circle cx="83" cy="407" r="2.2"/><circle cx="224" cy="364" r="2.2"/>
      </g>
      <g className={styles.scanMarks}>
        <path d="M20 264H74M182 264H246M117 164V192M117 322V358"/>
        <path d="M74 210H96V233M162 301H184V324"/>
      </g>
    </svg>
    <span className={styles.technical}>BB // 07 / COMMAND SIGNAL</span>
    <span className={styles.scanline}/>
  </div>;
}
