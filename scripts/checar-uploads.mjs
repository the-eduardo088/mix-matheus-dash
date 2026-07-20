/**
 * Confere se a aplicação consegue mesmo gravar anexos.
 *
 *   npm run check:uploads
 *
 * Rode na VPS com o MESMO usuário que roda a aplicação — testar como root não
 * prova nada, porque root escreve em qualquer lugar.
 */
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { userInfo } from "node:os";

import "dotenv/config";

const bruto = process.env.UPLOADS_DIR || "./uploads";
const pasta = resolve(bruto);

console.log(`\nUsuário do processo : ${userInfo().username}`);
console.log(`Diretório de trabalho: ${process.cwd()}`);
console.log(`UPLOADS_DIR          : ${bruto}`);
console.log(`Caminho resolvido    : ${pasta}\n`);

if (!process.env.UPLOADS_DIR) {
  console.log(
    "⚠ UPLOADS_DIR não está no .env — usando ./uploads relativo ao diretório de trabalho.",
  );
  console.log("  Sob systemd isso depende de WorkingDirectory. Prefira um caminho absoluto.\n");
}

let falhou = false;

try {
  const info = await stat(pasta);
  if (!info.isDirectory()) {
    console.log(`✗ ${pasta} existe mas não é um diretório.`);
    falhou = true;
  } else {
    console.log(`✓ diretório existe (permissões ${(info.mode & 0o777).toString(8)})`);
  }
} catch {
  console.log("· diretório não existe — tentando criar…");
  try {
    await mkdir(pasta, { recursive: true });
    console.log("✓ criado");
  } catch (err) {
    console.log(`✗ não foi possível criar: ${err.code ?? err.message}`);
    falhou = true;
  }
}

if (!falhou) {
  // Escrever de verdade, na mesma subpasta ano/mês que a aplicação usa.
  const agora = new Date();
  const sub = join(
    pasta,
    String(agora.getFullYear()),
    String(agora.getMonth() + 1).padStart(2, "0"),
  );
  const alvo = join(sub, ".teste-de-escrita");
  try {
    await mkdir(sub, { recursive: true });
    await writeFile(alvo, "ok");
    await rm(alvo);
    console.log(`✓ escrita e remoção funcionam em ${sub}`);
  } catch (err) {
    console.log(`✗ falha ao escrever em ${sub}: ${err.code ?? err.message}`);
    if (err.code === "EACCES" || err.code === "EPERM") {
      console.log(`\n  Correção:  sudo chown -R ${userInfo().username}: ${pasta}`);
    }
    falhou = true;
  }
}

console.log(
  falhou
    ? "\n✗ Uploads NÃO vão funcionar até isso ser resolvido.\n"
    : "\n✓ O disco está pronto. Se o upload ainda falhar, o corte é antes do Node — veja o limite de tamanho do proxy (nginx: client_max_body_size).\n",
);

process.exit(falhou ? 1 : 0);
