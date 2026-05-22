const ANSI_ENABLED = process.stdout.isTTY && process.env.NO_COLOR === undefined

function wrap(open: string, close: string) {
    return (s: string) => (ANSI_ENABLED ? `\x1b[${open}m${s}\x1b[${close}m` : s)
}

export const colors = {
    bold: wrap('1', '22'),
    dim: wrap('2', '22'),
    red: wrap('31', '39'),
    green: wrap('32', '39'),
    yellow: wrap('33', '39'),
    blue: wrap('34', '39'),
    cyan: wrap('36', '39'),
}
