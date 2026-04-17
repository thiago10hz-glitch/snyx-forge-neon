import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sword, Shield, FlaskConical, Heart, Zap, Trophy, RotateCcw } from "lucide-react";

type Player = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  level: number;
  xp: number;
  xpToNext: number;
  potions: number;
  weapon: string;
  weaponBonus: number;
};

type Enemy = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xpReward: number;
};

const ENEMY_POOL = [
  { name: "Goblin", emoji: "👺" },
  { name: "Esqueleto", emoji: "💀" },
  { name: "Lobo Sombrio", emoji: "🐺" },
  { name: "Orc", emoji: "👹" },
  { name: "Bandido", emoji: "🗡️" },
  { name: "Aranha Gigante", emoji: "🕷️" },
  { name: "Dragão Jovem", emoji: "🐲" },
  { name: "Necromante", emoji: "🧙‍♂️" },
];

const WEAPONS = [
  { name: "Espada Curta", bonus: 2 },
  { name: "Machado", bonus: 4 },
  { name: "Espada Longa", bonus: 6 },
  { name: "Lâmina Mística", bonus: 9 },
];

function makePlayer(name: string): Player {
  return {
    name: name || "Herói",
    hp: 50, maxHp: 50,
    atk: 8, def: 4,
    level: 1, xp: 0, xpToNext: 20,
    potions: 3,
    weapon: WEAPONS[0].name,
    weaponBonus: WEAPONS[0].bonus,
  };
}

function makeEnemy(playerLevel: number): Enemy {
  const tpl = ENEMY_POOL[Math.floor(Math.random() * Math.min(ENEMY_POOL.length, playerLevel + 2))];
  const scale = 1 + (playerLevel - 1) * 0.4;
  const hp = Math.floor((20 + Math.random() * 15) * scale);
  return {
    name: `${tpl.emoji} ${tpl.name}`,
    hp, maxHp: hp,
    atk: Math.floor((6 + Math.random() * 4) * scale),
    def: Math.floor((2 + Math.random() * 3) * scale),
    xpReward: Math.floor(10 * scale + Math.random() * 5),
  };
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export default function Rpg() {
  const [stage, setStage] = useState<"menu" | "battle" | "gameover">("menu");
  const [nameInput, setNameInput] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [defending, setDefending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  const addLog = (msg: string) => setLog((l) => [...l, msg]);

  const startGame = () => {
    const p = makePlayer(nameInput.trim());
    setPlayer(p);
    const e = makeEnemy(1);
    setEnemy(e);
    setLog([`⚔️ ${p.name} entra na masmorra...`, `Um ${e.name} surge das sombras!`]);
    setEnemiesDefeated(0);
    setStage("battle");
  };

  const checkLevelUp = (p: Player): Player => {
    let np = { ...p };
    while (np.xp >= np.xpToNext) {
      np.xp -= np.xpToNext;
      np.level += 1;
      np.maxHp += 10;
      np.hp = np.maxHp;
      np.atk += 3;
      np.def += 2;
      np.xpToNext = Math.floor(np.xpToNext * 1.5);
      addLog(`🌟 LEVEL UP! Agora nível ${np.level}. HP/ATK/DEF aumentados!`);
      // upgrade weapon every 2 levels
      const wIdx = Math.min(Math.floor(np.level / 2), WEAPONS.length - 1);
      if (WEAPONS[wIdx].name !== np.weapon) {
        np.weapon = WEAPONS[wIdx].name;
        np.weaponBonus = WEAPONS[wIdx].bonus;
        addLog(`🗡️ Nova arma desbloqueada: ${np.weapon}!`);
      }
    }
    return np;
  };

  const enemyTurn = (p: Player, e: Enemy, isDefending: boolean) => {
    const baseDmg = Math.max(1, e.atk - p.def + rand(-2, 2));
    const dmg = isDefending ? Math.max(1, Math.floor(baseDmg / 2)) : baseDmg;
    const newHp = Math.max(0, p.hp - dmg);
    addLog(`${e.name} ataca${isDefending ? " (defendido)" : ""} e causa ${dmg} de dano.`);
    const newPlayer = { ...p, hp: newHp };
    setPlayer(newPlayer);
    setDefending(false);
    if (newHp <= 0) {
      addLog(`💀 ${p.name} foi derrotado...`);
      setStage("gameover");
    }
    setBusy(false);
  };

  const handleAttack = () => {
    if (!player || !enemy || busy) return;
    setBusy(true);
    const dmg = Math.max(1, player.atk + player.weaponBonus - enemy.def + rand(-2, 3));
    const newEnemyHp = Math.max(0, enemy.hp - dmg);
    addLog(`⚔️ ${player.name} ataca com ${player.weapon} e causa ${dmg} de dano.`);
    const newEnemy = { ...enemy, hp: newEnemyHp };
    setEnemy(newEnemy);

    if (newEnemyHp <= 0) {
      addLog(`✨ ${enemy.name} foi derrotado! +${enemy.xpReward} XP`);
      let newPlayer = { ...player, xp: player.xp + enemy.xpReward };
      newPlayer = checkLevelUp(newPlayer);
      setPlayer(newPlayer);
      setEnemiesDefeated((c) => c + 1);
      setTimeout(() => {
        const next = makeEnemy(newPlayer.level + Math.floor(enemiesDefeated / 3));
        setEnemy(next);
        addLog(`Um ${next.name} aparece!`);
        setBusy(false);
      }, 800);
      return;
    }
    setTimeout(() => enemyTurn(player, newEnemy, false), 700);
  };

  const handleDefend = () => {
    if (!player || !enemy || busy) return;
    setBusy(true);
    setDefending(true);
    addLog(`🛡️ ${player.name} se prepara para defender.`);
    setTimeout(() => enemyTurn(player, enemy, true), 600);
  };

  const handlePotion = () => {
    if (!player || !enemy || busy) return;
    if (player.potions <= 0) {
      addLog("❌ Sem poções!");
      return;
    }
    setBusy(true);
    const heal = 25;
    const newHp = Math.min(player.maxHp, player.hp + heal);
    addLog(`🧪 ${player.name} usa uma poção e recupera ${newHp - player.hp} HP.`);
    const newPlayer = { ...player, hp: newHp, potions: player.potions - 1 };
    setPlayer(newPlayer);
    setTimeout(() => enemyTurn(newPlayer, enemy, false), 600);
  };

  const restart = () => {
    setStage("menu");
    setPlayer(null);
    setEnemy(null);
    setLog([]);
    setEnemiesDefeated(0);
    setNameInput("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ⚔️ Masmorra do SnyX
          </h1>
          <p className="text-muted-foreground mt-2">RPG 2D de fantasia medieval por turnos</p>
        </header>

        {stage === "menu" && (
          <Card className="p-8 max-w-md mx-auto space-y-4">
            <h2 className="text-2xl font-semibold">Crie seu herói</h2>
            <Input
              placeholder="Nome do personagem"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => e.key === "Enter" && startGame()}
            />
            <Button className="w-full" size="lg" onClick={startGame}>
              Iniciar Aventura
            </Button>
          </Card>
        )}

        {stage === "battle" && player && enemy && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 border-primary/40">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{player.name}</h3>
                  <Badge variant="outline">Nv. {player.level}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="flex justify-between"><span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-500" /> HP</span><span>{player.hp}/{player.maxHp}</span></div>
                    <Progress value={(player.hp / player.maxHp) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between"><span className="flex items-center gap-1"><Zap className="h-3 w-3 text-yellow-500" /> XP</span><span>{player.xp}/{player.xpToNext}</span></div>
                    <Progress value={(player.xp / player.xpToNext) * 100} className="h-2" />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                    <span>⚔️ ATK {player.atk + player.weaponBonus}</span>
                    <span>🛡️ DEF {player.def}</span>
                    <span>🧪 {player.potions}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Arma: {player.weapon}</div>
                </div>
              </Card>

              <Card className="p-4 border-destructive/40">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{enemy.name}</h3>
                  <Badge variant="destructive">Inimigo</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="flex justify-between"><span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-500" /> HP</span><span>{enemy.hp}/{enemy.maxHp}</span></div>
                    <Progress value={(enemy.hp / enemy.maxHp) * 100} className="h-2" />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                    <span>⚔️ ATK {enemy.atk}</span>
                    <span>🛡️ DEF {enemy.def}</span>
                    <span>✨ {enemy.xpReward} XP</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Log */}
            <Card className="p-4">
              <div ref={logRef} className="h-48 overflow-y-auto text-sm space-y-1 font-mono">
                {log.map((l, i) => (
                  <div key={i} className="text-foreground/80">{l}</div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={handleAttack} disabled={busy} size="lg" variant="default">
                <Sword className="h-4 w-4 mr-2" /> Atacar
              </Button>
              <Button onClick={handleDefend} disabled={busy} size="lg" variant="secondary">
                <Shield className="h-4 w-4 mr-2" /> Defender
              </Button>
              <Button onClick={handlePotion} disabled={busy || player.potions <= 0} size="lg" variant="outline">
                <FlaskConical className="h-4 w-4 mr-2" /> Poção ({player.potions})
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              Inimigos derrotados: {enemiesDefeated}
            </div>
          </div>
        )}

        {stage === "gameover" && player && (
          <Card className="p-8 max-w-md mx-auto text-center space-y-4">
            <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
            <h2 className="text-3xl font-bold">Game Over</h2>
            <p className="text-muted-foreground">
              {player.name} caiu em batalha após derrotar <span className="text-primary font-bold">{enemiesDefeated}</span> inimigos.
            </p>
            <p className="text-sm">Nível alcançado: <Badge>{player.level}</Badge></p>
            <Button onClick={restart} size="lg" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" /> Reiniciar Jogo
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}