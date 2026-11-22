// Kurzanleitungen für alle Übungen: Animation, Schwierigkeit, Ablauf und typische Fehler.
// level: 1 = einfach (Maschine, kaum Technik), 2 = mittel, 3 = technisch anspruchsvoll

import { getEx } from './exercises.js';

const G = (anim, level, steps, tips) => ({ anim, level, steps, tips });

export const GUIDES = {
  // ---------- Kniebeuge ----------
  'lh-kniebeuge': G('squat', 3, [
    'Stange im Rack auf Schulterhöhe. Darunter gehen, Stange auf den oberen Rücken legen (nicht auf den Nacken), Hände etwas breiter als die Schultern.',
    'Ausheben, 2 Schritte zurück. Füße schulterbreit, Zehen leicht nach außen.',
    'Tief einatmen, Bauch fest anspannen. Hüfte nach hinten und Knie nach außen beugen, bis die Oberschenkel mindestens waagerecht sind.',
    'Über die ganze Fußsohle kraftvoll hochdrücken, oben ausatmen.',
  ], [
    'Knie nicht nach innen fallen lassen – sie zeigen in Richtung Zehen.',
    'Rücken bleibt gerade, Fersen bleiben am Boden.',
    'Sicherheitsablagen im Rack knapp unter die tiefste Position stellen.',
  ]),
  'lh-frontkniebeuge': G('frontsquat', 3, [
    'Stange vorne auf die Schultern legen, Ellbogen weit nach vorne-oben – die Finger halten die Stange nur locker.',
    'Füße schulterbreit, Oberkörper bleibt sehr aufrecht.',
    'Gerade nach unten beugen, Knie dürfen weit nach vorne.',
    'Mit hohen Ellbogen kraftvoll hochdrücken.',
  ], [
    'Ellbogen sinken = Stange rollt nach vorne. Ellbogen immer hoch halten.',
    'Wenn die Handgelenke schmerzen: Arme vor der Brust kreuzen.',
  ]),
  'ma-hackenschmidt': G('hack', 1, [
    'Rücken fest an das Polster, Schultern unter die Schulterpolster.',
    'Füße schulterbreit mittig auf die Plattform. Sicherung lösen.',
    'Langsam beugen, bis die Oberschenkel etwa waagerecht sind.',
    'Über die ganze Fußsohle zurückdrücken, Knie oben nicht ganz durchstrecken.',
  ], [
    'Fersen bleiben auf der Plattform.',
    'Knie zeigen in Richtung Zehen.',
  ]),
  'ma-beinpresse': G('legpress', 1, [
    'Rücken und Po fest ins Polster. Füße schulterbreit mittig auf die Platte.',
    'Gewicht anheben, Sicherung lösen.',
    'Knie langsam Richtung Brust beugen, bis etwa 90° im Knie.',
    'Gleichmäßig zurückdrücken – Knie oben nicht ganz durchstrecken.',
  ], [
    'Po darf sich unten nicht vom Polster abheben (sonst rundet der Rücken).',
    'Am Ende des Satzes die Sicherung wieder einrasten.',
  ]),
  'kh-goblet': G('goblet', 2, [
    'Eine Kurzhantel senkrecht vor der Brust halten, Ellbogen zeigen nach unten.',
    'Füße etwas breiter als schulterbreit, Zehen leicht nach außen.',
    'Tief in die Hocke gehen, Ellbogen landen zwischen den Knien.',
    'Aufrecht wieder hochdrücken.',
  ], [
    'Oberkörper bleibt aufrecht, Hantel bleibt nah am Körper.',
    'Perfekte Übung, um die Kniebeuge zu lernen.',
  ]),
  // ---------- Hüfte ----------
  'lh-kreuzheben': G('deadlift', 3, [
    'Füße hüftbreit, Stange über der Fußmitte (fast an den Schienbeinen).',
    'Hüfte nach hinten, Stange schulterbreit greifen. Brust raus, Rücken gerade, Schultern leicht vor der Stange.',
    'Einatmen, Bauch fest. Die Stange eng am Bein nach oben schieben – Beine und Hüfte strecken gleichzeitig.',
    'Oben aufrecht stehen (nicht nach hinten lehnen). Kontrolliert auf dem gleichen Weg ablegen.',
  ], [
    'Niemals mit rundem Rücken ziehen – lieber weniger Gewicht.',
    'Stange nicht von den Beinen weg nach vorne wandern lassen.',
    'Nicht aus den Armen reißen: Arme bleiben gestreckt wie Seile.',
  ]),
  'lh-rdl': G('rdl', 3, [
    'Aufrecht stehen, Stange schulterbreit vor den Oberschenkeln, Knie leicht gebeugt.',
    'Hüfte weit nach hinten schieben, Oberkörper kippt nach vorne. Stange gleitet an den Beinen nach unten.',
    'Bis knapp unter die Knie oder bis zur starken Dehnung hinten im Oberschenkel.',
    'Hüfte nach vorne schieben und aufrichten, oben den Po anspannen.',
  ], [
    'Rücken bleibt die ganze Zeit gerade.',
    'Knie bleiben fast gleich gebeugt – keine Kniebeuge daraus machen.',
  ]),
  'kh-rdl': G('rdl_db', 2, [
    'Je eine Kurzhantel vor den Oberschenkeln, Knie leicht gebeugt.',
    'Hüfte nach hinten schieben, Hanteln nah an den Beinen nach unten führen.',
    'Bei starker Dehnung hinten im Oberschenkel stoppen.',
    'Hüfte nach vorne schieben, aufrichten, Po anspannen.',
  ], [
    'Rücken bleibt gerade, Blick leicht nach unten.',
    'Die Bewegung kommt aus der Hüfte, nicht aus dem Rücken.',
  ]),
  'lh-hipthrust': G('hipthrust', 2, [
    'Oberer Rücken an eine Bank, Stange (mit Polster) über der Hüfte.',
    'Füße flach auf dem Boden, etwa hüftbreit, so dass die Schienbeine oben senkrecht stehen.',
    'Hüfte nach oben drücken, bis der Körper von Knie bis Schulter eine Linie bildet. Oben den Po 1 s fest anspannen.',
    'Kontrolliert absenken.',
  ], [
    'Oben kein Hohlkreuz: Rippen unten lassen, Kinn leicht zur Brust.',
    'Druck über die Fersen, nicht über die Zehen.',
  ]),
  'kg-hyperext': G('hyperext', 1, [
    'Polster knapp unter die Hüftknochen einstellen, Fersen unter die Fußrolle.',
    'Arme vor der Brust kreuzen.',
    'Oberkörper langsam nach vorne-unten senken.',
    'Bis zur geraden Linie mit den Beinen aufrichten – nicht höher.',
  ], [
    'Oben nicht ins Hohlkreuz überstrecken.',
    'Langsam und kontrolliert, kein Schwung.',
  ]),
  'ma-abduktoren': G('abductor', 1, [
    'Aufrecht hinsetzen, Rücken ans Polster, Polster an der Außenseite der Knie.',
    'Griffe fassen.',
    'Beine kontrolliert nach außen drücken, kurz halten.',
    'Langsam zurückführen, Gewicht nicht aufknallen lassen.',
  ], [
    'Oberkörper bleibt ruhig, kein Schwung.',
  ]),
  // ---------- Einbeinig ----------
  'kh-ausfallschritt': G('lunge', 2, [
    'Aufrecht stehen, je eine Kurzhantel seitlich in den Händen.',
    'Einen großen Schritt nach vorne machen.',
    'Senkrecht nach unten gehen, bis das hintere Knie fast den Boden berührt.',
    'Über die vordere Ferse kraftvoll zurück in den Stand drücken. Seiten abwechseln.',
  ], [
    'Vorderes Knie bleibt über dem Fuß und fällt nicht nach innen.',
    'Oberkörper aufrecht halten.',
  ]),
  'kh-bulgarisch': G('bulgarian', 3, [
    'Rücken zur Bank stellen, einen Fußrücken hinten auf die Bank legen.',
    'Vorderen Fuß so weit vorne aufsetzen, dass das Knie unten etwa über dem Fuß ist.',
    'Senkrecht nach unten beugen, bis der vordere Oberschenkel etwa waagerecht ist.',
    'Über die vordere Ferse hochdrücken. Alle Wdh., dann Seite wechseln.',
  ], [
    'Fast das ganze Gewicht liegt auf dem vorderen Bein.',
    'Gleichgewicht schwierig? Erst ohne Hanteln oder mit einer Hand an einer Stange üben.',
  ]),
  // ---------- Isoliert Beine ----------
  'ma-beinstrecker': G('legext', 1, [
    'Rückenlehne so einstellen, dass die Knie genau am Drehpunkt der Maschine sind.',
    'Fußpolster vorne knapp über den Knöcheln.',
    'Beine strecken, oben kurz anspannen.',
    'Langsam (2–3 s) absenken.',
  ], [
    'Po bleibt auf dem Sitz, an den Griffen festhalten.',
    'Nicht mit Schwung arbeiten.',
  ]),
  'ma-beinbeuger-sitz': G('legcurl_seated', 1, [
    'Knie auf Höhe des Drehpunkts, Polster oben fest auf die Oberschenkel.',
    'Unteres Polster hinten knapp über den Fersen.',
    'Unterschenkel kraftvoll nach unten-hinten beugen.',
    'Langsam zurück nach vorne führen.',
  ], [
    'Oberkörper anlehnen, nicht nach vorne ziehen.',
  ]),
  'ma-beinbeuger-lieg': G('legcurl_lying', 1, [
    'Bäuchlings hinlegen, Knie knapp hinter der Polsterkante, Polster über den Fersen.',
    'Griffe vorne festhalten, Hüfte bleibt auf dem Polster.',
    'Fersen Richtung Po ziehen.',
    'Langsam wieder strecken.',
  ], [
    'Hüfte nicht vom Polster abheben, kein Hohlkreuz.',
  ]),
  'ma-waden-stehend': G('calf', 1, [
    'Schultern unter die Polster, Fußballen auf die Kante, Fersen frei.',
    'Fersen langsam so tief wie möglich senken (Dehnung).',
    'Auf die Zehenspitzen hochdrücken, oben 1 s halten.',
  ], [
    'Knie bleiben fast gestreckt, aber nicht hart durchgedrückt.',
    'Volle Bewegung statt Wippen.',
  ]),
  'ma-waden-sitzend': G('calf_seated', 1, [
    'Hinsetzen, Polster auf die Oberschenkel knapp über den Knien.',
    'Fußballen auf die Kante, Sicherung lösen.',
    'Fersen tief senken, dann so hoch wie möglich drücken.',
  ], [
    'Langsam, mit kurzer Pause oben und unten.',
  ]),
  // ---------- Drücken horizontal ----------
  'lh-bankdruecken': G('bench', 3, [
    'Auf die Bank legen, Augen unter der Stange. Füße fest am Boden.',
    'Schulterblätter zusammen und nach unten ziehen, Stange etwas breiter als schulterbreit greifen.',
    'Ausheben, Stange über die Schultern bringen. Kontrolliert zur unteren Brust senken, Ellbogen etwa 45° vom Körper.',
    'Kraftvoll nach oben drücken.',
  ], [
    'Stange nicht von der Brust abprallen lassen.',
    'Po bleibt auf der Bank. Bei schweren Sätzen Sicherheitsablagen oder einen Partner nutzen.',
    'Daumen immer um die Stange.',
  ]),
  'kh-bankdruecken': G('bench_db', 2, [
    'Mit den Hanteln auf den Oberschenkeln hinsetzen, beim Zurücklegen mit hochnehmen.',
    'Schulterblätter zusammenziehen, Hanteln neben der Brust, Ellbogen etwa 45°.',
    'Nach oben drücken, bis die Arme fast gestreckt sind.',
    'Langsam wieder neben die Brust senken.',
  ], [
    'Hanteln oben nicht zusammenschlagen.',
    'Zum Ablegen: Hanteln auf die Oberschenkel bringen und aufsetzen.',
  ]),
  'lh-schraegbank': G('incline', 3, [
    'Bank auf 30–45° stellen, Schulterblätter zusammen.',
    'Stange etwas breiter als schulterbreit greifen und ausheben.',
    'Zur oberen Brust (unter dem Schlüsselbein) senken.',
    'Senkrecht nach oben drücken.',
  ], [
    'Po bleibt auf der Bank.',
    'Steiler als 45° wird es eher eine Schulterübung.',
  ]),
  'kh-schraegbank': G('incline_db', 2, [
    'Bank auf 30–45°, mit den Hanteln auf den Oberschenkeln hinsetzen und zurücklehnen.',
    'Hanteln neben der oberen Brust, Ellbogen etwas unter Schulterhöhe.',
    'Nach oben drücken.',
    'Langsam zurück zur Brust.',
  ], [
    'Schulterblätter bleiben zusammengezogen.',
  ]),
  'ma-brustpresse': G('chestpress', 1, [
    'Sitz so einstellen, dass die Griffe auf Höhe der mittleren Brust sind.',
    'Rücken ans Polster, Schulterblätter zusammen.',
    'Griffe nach vorne drücken, bis die Arme fast gestreckt sind.',
    'Langsam zurückführen, bis eine leichte Dehnung in der Brust kommt.',
  ], [
    'Schultern nicht nach vorne ziehen lassen.',
  ]),
  'kg-dips': G('dips', 2, [
    'An den Barren stützen, Arme gestreckt, Schultern tief.',
    'Oberkörper leicht nach vorne neigen.',
    'Langsam absenken, bis die Oberarme etwa waagerecht sind.',
    'Kraftvoll hochdrücken.',
  ], [
    'Nicht tiefer gehen, wenn es vorne in der Schulter zieht.',
    'Zu schwer? An der Dip-Maschine mit Unterstützung beginnen.',
  ]),
  'kg-liegestuetz': G('pushup', 1, [
    'Hände etwas breiter als schulterbreit, Körper bildet eine gerade Linie.',
    'Bauch und Po anspannen.',
    'Brust bis kurz über den Boden senken, Ellbogen etwa 45° vom Körper.',
    'Kraftvoll hochdrücken.',
  ], [
    'Hüfte nicht durchhängen lassen.',
    'Zu schwer? Hände erhöht (Bank) oder auf den Knien.',
  ]),
  // ---------- Drücken vertikal ----------
  'lh-schulterdruecken': G('ohp', 3, [
    'Stange im Rack auf Brusthöhe, schulterbreit greifen, vorne auf den Schultern ablegen.',
    'Füße hüftbreit, Po und Bauch fest anspannen.',
    'Stange gerade nach oben drücken, Kopf kurz nach hinten nehmen und danach unter die Stange schieben.',
    'Oben steht die Stange über der Fußmitte. Kontrolliert zurück auf die Schultern.',
  ], [
    'Nicht ins Hohlkreuz lehnen – Bauch fest.',
    'Unterarme stehen senkrecht unter der Stange.',
  ]),
  'kh-schulterdruecken': G('ohp_seated', 2, [
    'Bank fast senkrecht stellen, Hanteln auf Schulterhöhe, Handflächen nach vorne.',
    'Rücken fest an die Lehne.',
    'Nach oben drücken, bis die Arme fast gestreckt sind.',
    'Langsam auf Schulterhöhe zurück.',
  ], [
    'Kein Hohlkreuz, Bauch anspannen.',
  ]),
  'ma-schulterpresse': G('ohp_machine', 1, [
    'Sitz so einstellen, dass die Griffe auf Schulterhöhe sind.',
    'Rücken ans Polster.',
    'Griffe nach oben drücken.',
    'Langsam zurück bis Schulterhöhe.',
  ], [
    'Ellbogen leicht vor dem Körper, nicht ganz seitlich.',
  ]),
  // ---------- Rudern ----------
  'lh-rudern': G('row', 3, [
    'Stange schulterbreit greifen, Knie leicht beugen, Oberkörper etwa 45° nach vorne neigen.',
    'Rücken gerade, Bauch fest, Arme hängen gestreckt.',
    'Stange zum Bauchnabel ziehen, Schulterblätter zusammenziehen.',
    'Kontrolliert wieder absenken.',
  ], [
    'Oberkörper bleibt ruhig – kein Schwung aus dem Rücken.',
    'Rücken nie rund werden lassen.',
  ]),
  'kh-rudern': G('row_db', 2, [
    'Eine Hand (und evtl. ein Knie) auf der Bank abstützen, Rücken waagerecht und gerade.',
    'Hantel hängt gestreckt unter der Schulter.',
    'Ellbogen nah am Körper nach hinten-oben zur Hüfte ziehen.',
    'Langsam absenken. Alle Wdh., dann Seite wechseln.',
  ], [
    'Oberkörper nicht aufdrehen.',
    'Ziehen mit dem Ellbogen, nicht mit der Hand.',
  ]),
  'kz-rudern': G('row_cable', 1, [
    'Hinsetzen, Füße auf die Stütze, Knie leicht gebeugt, Griff fassen.',
    'Aufrecht sitzen, Brust raus.',
    'Griff zum Bauch ziehen, Schulterblätter zusammen.',
    'Arme langsam wieder strecken, Schultern dürfen leicht nach vorne.',
  ], [
    'Nicht mit dem Oberkörper weit nach hinten schaukeln.',
  ]),
  'ma-rudern': G('row_machine', 1, [
    'Sitz so einstellen, dass die Brust am Polster liegt und die Griffe auf Brusthöhe sind.',
    'Griffe fassen, Arme gestreckt.',
    'Ellbogen nach hinten ziehen, Schulterblätter zusammen.',
    'Langsam zurück.',
  ], [
    'Brust bleibt am Polster.',
  ]),
  // ---------- Ziehen vertikal ----------
  'kg-klimmzug': G('pullup', 2, [
    'Stange etwas breiter als schulterbreit greifen (Handflächen nach vorne), frei hängen.',
    'Schultern nach unten ziehen, Bauch fest.',
    'Hochziehen, bis das Kinn über der Stange ist.',
    'Langsam ganz absenken, bis die Arme fast gestreckt sind.',
  ], [
    'Kein Schwung mit den Beinen.',
    'Noch kein Klimmzug? Mit Band, Maschine oder nur langsamem Absenken üben.',
  ]),
  'kz-latziehen': G('pulldown', 1, [
    'Oberschenkelpolster so einstellen, dass die Beine fest sitzen.',
    'Stange breit greifen, leicht zurücklehnen, Brust raus.',
    'Stange zur oberen Brust ziehen, Ellbogen nach unten.',
    'Langsam nach oben zurück, bis die Arme gestreckt sind.',
  ], [
    'Nicht hinter den Kopf ziehen.',
    'Kein Schaukeln mit dem Oberkörper.',
  ]),
  'kz-latziehen-eng': G('pulldown_narrow', 1, [
    'Engen Griff (V-Griff) einhängen, hinsetzen, Beine fixieren.',
    'Leicht zurücklehnen, Brust raus.',
    'Griff zur Brust ziehen, Ellbogen nah am Körper.',
    'Langsam zurück nach oben.',
  ], [
    'Schultern unten lassen, nicht hochziehen.',
  ]),
  // ---------- Brust / Schulter isoliert ----------
  'kz-crossover': G('crossover', 2, [
    'Seilzüge oben einhängen, Griffe fassen, einen Schritt nach vorne, leichte Schrittstellung.',
    'Arme leicht gebeugt und seitlich geöffnet.',
    'Hände in einem Bogen vor dem Körper nach unten-vorne zusammenführen.',
    'Langsam zurück, bis eine Dehnung in der Brust kommt.',
  ], [
    'Ellbogenwinkel bleibt gleich – es ist keine Drückbewegung.',
  ]),
  'ma-butterfly': G('butterfly', 1, [
    'Sitz so einstellen, dass die Griffe auf Brusthöhe sind.',
    'Rücken ans Polster, Arme leicht gebeugt.',
    'Arme vor der Brust zusammenführen, kurz anspannen.',
    'Langsam öffnen, bis eine leichte Dehnung kommt.',
  ], [
    'Nicht zu weit nach hinten öffnen (Schulter schonen).',
  ]),
  'kh-seitheben': G('lateral', 1, [
    'Aufrecht stehen, Hanteln seitlich, Arme leicht gebeugt.',
    'Arme seitlich bis Schulterhöhe heben, Ellbogen führen.',
    'Langsam absenken.',
  ], [
    'Lieber leicht und sauber – kein Schwung aus dem Körper.',
    'Schultern nicht zu den Ohren ziehen.',
  ]),
  'kz-seitheben': G('lateral_cable', 1, [
    'Seitlich neben den Kabelzug stellen, Griff unten mit der entfernten Hand fassen.',
    'Arm leicht gebeugt seitlich bis Schulterhöhe heben.',
    'Langsam absenken. Alle Wdh., dann Seite wechseln.',
  ], [
    'Oberkörper bleibt ruhig.',
  ]),
  'kz-facepull': G('facepull', 1, [
    'Seil auf Kopfhöhe einhängen, mit beiden Händen fassen, Daumen zeigen zu dir.',
    'Einen Schritt zurück, Arme gestreckt.',
    'Seil Richtung Stirn ziehen, Ellbogen hoch und weit nach außen.',
    'Langsam zurück.',
  ], [
    'Leichtes Gewicht, volle Bewegung – das ist eine Haltungsübung.',
  ]),
  'ma-reverse-butterfly': G('reverse_fly', 1, [
    'Mit der Brust zum Polster setzen, Griffe auf Schulterhöhe.',
    'Arme leicht gebeugt.',
    'Arme weit nach hinten-außen öffnen, Schulterblätter zusammen.',
    'Langsam zurück.',
  ], [
    'Brust bleibt am Polster, kein Schwung.',
  ]),
  // ---------- Arme ----------
  'kh-bizepscurl': G('curl', 1, [
    'Aufrecht stehen, Hanteln seitlich, Handflächen nach vorne.',
    'Ellbogen bleiben am Körper. Hanteln hoch zur Schulter beugen.',
    'Oben kurz anspannen, langsam absenken.',
  ], [
    'Nicht mit dem Oberkörper schwingen.',
    'Unten die Arme fast ganz strecken.',
  ]),
  'kh-hammercurl': G('curl', 1, [
    'Hanteln seitlich, Handflächen zeigen zueinander (wie ein Hammer).',
    'Ellbogen am Körper, Hanteln hochbeugen.',
    'Langsam absenken.',
  ], [
    'Handgelenk bleibt gerade.',
  ]),
  'lh-curl': G('curl_bar', 1, [
    'SZ-Stange schulterbreit im Untergriff fassen, aufrecht stehen.',
    'Ellbogen am Körper, Stange zur Brust beugen.',
    'Langsam absenken.',
  ], [
    'Kein Schwung aus dem Rücken.',
  ]),
  'kz-bizepscurl': G('curl_cable', 1, [
    'Stange oder Seil unten am Kabelzug einhängen, aufrecht stehen.',
    'Ellbogen am Körper, Griff zur Schulter beugen.',
    'Langsam zurück.',
  ], [
    'Ellbogen nicht nach vorne wandern lassen.',
  ]),
  'kz-trizepsdruecken': G('pushdown', 1, [
    'Seil oder Stange oben einhängen, leicht nach vorne lehnen.',
    'Ellbogen seitlich am Körper fixieren.',
    'Unterarme nach unten strecken, unten kurz anspannen.',
    'Langsam bis etwa Brusthöhe zurück.',
  ], [
    'Nur die Unterarme bewegen sich – Ellbogen bleiben fest.',
  ]),
  'kz-trizeps-ueberkopf': G('overhead_tri', 2, [
    'Seil einhängen, mit dem Rücken zum Kabelzug stellen, Seil hinter den Kopf.',
    'Leichte Schrittstellung, Oberkörper etwas nach vorne.',
    'Arme nach vorne-oben strecken, Ellbogen bleiben neben dem Kopf.',
    'Langsam zurück hinter den Kopf.',
  ], [
    'Ellbogen nicht weit nach außen gehen lassen.',
  ]),
  'lh-frenchpress': G('french', 2, [
    'Auf die Bank legen, SZ-Stange mit gestreckten Armen über der Brust.',
    'Oberarme leicht Richtung Kopf neigen und dort fixieren.',
    'Nur die Unterarme beugen und die Stange Richtung Stirn senken.',
    'Wieder strecken.',
  ], [
    'Langsam – die Stange ist nahe am Kopf.',
    'Ellbogen zeigen nach oben, nicht nach außen.',
  ]),
  // ---------- Rumpf ----------
  'kz-crunch': G('cable_crunch', 2, [
    'Seil oben einhängen, vor den Kabelzug knien, Seil neben dem Kopf halten.',
    'Hüfte bleibt fest, der Oberkörper rollt sich ein.',
    'Ellbogen Richtung Knie ziehen, Bauch fest anspannen.',
    'Langsam aufrollen.',
  ], [
    'Nicht aus den Armen oder der Hüfte ziehen.',
  ]),
  'kg-beinheben': G('leg_raise', 2, [
    'An der Stange hängen, Schultern aktiv nach unten.',
    'Beine kontrolliert nach vorne-oben heben (gebeugt = leichter, gestreckt = schwerer).',
    'Langsam absenken, ohne zu schwingen.',
  ], [
    'Kein Schwung.',
    'Zu schwer? Knie anziehen oder an der Dip-Station üben.',
  ]),
  'kz-pallof': G('pallof', 1, [
    'Seitlich neben den Kabelzug stellen, Griff auf Brusthöhe mit beiden Händen vor der Brust.',
    'Ein Schritt weg, bis Spannung da ist. Bauch fest.',
    'Arme gerade nach vorne strecken und 2 s halten – der Zug darf dich nicht verdrehen.',
    'Zurück zur Brust. Danach Seite wechseln.',
  ], [
    'Hüfte und Schultern bleiben gerade nach vorne ausgerichtet.',
  ]),
  // ---------- Kondition ----------
  'c-rudergeraet': G('rower', 2, [
    'Füße festschnallen, Griff fassen, Arme gestreckt.',
    'Reihenfolge ziehen: Beine – Oberkörper – Arme.',
    'Zurück in umgekehrter Reihenfolge: Arme – Oberkörper – Beine.',
    'Intervalle: zügig, dann locker im Wechsel.',
  ], [
    'Kraft kommt zu 60 % aus den Beinen.',
    'Rücken bleibt gerade, nicht weit nach hinten lehnen.',
  ]),
  'c-ergometer': G('bike', 1, [
    'Sattel so einstellen, dass das Bein unten fast gestreckt ist.',
    'Locker einfahren, dann Intervalle: schnell treten, dann locker.',
    'Widerstand so wählen, dass die schnellen Phasen fordernd sind.',
  ], [
    'Knie zeigen gerade nach vorne.',
  ]),
  'c-laufband': G('walk', 1, [
    'Steigung 10–12 % einstellen, Tempo zügiges Gehen (ca. 5 km/h).',
    'Aufrecht gehen, Arme schwingen mit.',
    'Nicht am Geländer festhalten.',
  ], [
    'Zu anstrengend? Erst die Steigung, dann das Tempo reduzieren.',
  ]),
  'c-kbswing': G('swing', 3, [
    'Füße etwas breiter als hüftbreit, Kettlebell vor dir am Boden.',
    'Hüfte nach hinten, Kettlebell greifen und zwischen den Beinen nach hinten schwingen.',
    'Hüfte explosiv nach vorne strecken – die Kettlebell schwingt bis Brusthöhe.',
    'Fallen lassen, Hüfte wieder nach hinten. Rhythmisch wiederholen.',
  ], [
    'Es ist eine Hüftbewegung, keine Kniebeuge und kein Heben mit den Armen.',
    'Rücken bleibt gerade, oben Po und Bauch anspannen.',
  ]),
  // ---------- Beweglichkeit ----------
  'm-aufwaermen': G('wgs', 1, [
    'Hüftkreisen und Cat-Cow (Rücken rund – Rücken hohl) je 30 s.',
    'Weltgrößte Dehnung: tiefer Ausfallschritt, Hand innen neben den Fuß, dann den anderen Arm zur Decke drehen. 5× pro Seite.',
    'Schulterkreisen mit Band oder Armkreisen.',
  ], [
    'Ruhig atmen, nichts erzwingen.',
  ]),
  'm-huefte': G('deep_squat', 1, [
    '90/90-Wechsel: im Sitzen beide Beine 90° gebeugt, Knie abwechselnd zur anderen Seite kippen.',
    'Tiefe Hocke halten, Ellbogen drücken die Knie nach außen.',
    'Hüftbeuger-Dehnung im Halbknien, Po anspannen.',
  ], [
    'In jeder Position ruhig weiteratmen.',
  ]),
  'm-schulter': G('passthrough', 1, [
    'Band breit greifen, mit gestreckten Armen über den Kopf nach hinten und zurück führen (Durchzüge).',
    'Außenrotation: Ellbogen am Körper, Band nach außen ziehen.',
    'Wandrutschen: Rücken an die Wand, Arme in U-Form hoch und runter schieben.',
  ], [
    'Griff breiter wählen, wenn es zwickt.',
  ]),
  'm-cooldown': G('stretch', 1, [
    'Beinbeuger: Beine fast gestreckt, mit geradem Rücken nach vorne beugen.',
    'Brust: Unterarm an einen Türrahmen, Oberkörper wegdrehen.',
    'Lat und Hüfte je 30–45 s dehnen.',
  ], [
    'Dehnen soll ziehen, aber nicht schmerzen.',
  ]),
};

export const LEVEL_LABEL = { 1: 'Einfach', 2: 'Mittel', 3: 'Technisch anspruchsvoll' };

/** Anleitung zu einer Übung (Fallback für unbekannte Übungen). */
export function guideFor(id) {
  const g = GUIDES[id];
  if (g) return g;
  const ex = getEx(id);
  return { anim: null, level: 1, steps: ex.text ? [ex.text] : ['Kontrolliert und mit voller Bewegung ausführen.'], tips: [] };
}

/** Wie oft wurde die Übung schon trainiert (Anzahl verschiedener Einheiten)? */
export function timesDone(id, sets = []) {
  return new Set(sets.filter((s) => s.exerciseId === id && !s.warmup).map((s) => s.sessionId)).size;
}

/**
 * Soll die App eine Anleitung vorschlagen?
 * @returns {{suggest:boolean, reason:string}}
 */
export function guideAdvice(id, { sets = [], experience = 'fortgeschritten', known = [], sessionsDone = null, enabled = true } = {}) {
  if (!enabled || known.includes(id)) return { suggest: false, reason: '' };
  const g = guideFor(id);
  const n = sessionsDone ?? timesDone(id, sets);
  const beginner = experience === 'anfaenger';
  const returning = experience === 'wiedereinsteiger';
  if (n === 0) {
    if (beginner || returning || g.level >= 2) return { suggest: true, reason: 'Neu für dich' };
    return { suggest: false, reason: '' }; // Fortgeschrittene + einfache Maschine
  }
  if (g.level === 3 && ((beginner && n < 4) || (returning && n < 2))) {
    return { suggest: true, reason: 'Technisch anspruchsvoll – kurz die Technik auffrischen?' };
  }
  return { suggest: false, reason: '' };
}
