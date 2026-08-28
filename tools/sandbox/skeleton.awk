# Reduce a shell command to its live syntax skeleton.
#
# The gate has to know whether a command chains into another command. Grepping
# the raw string for ';' or '&&' gets that wrong in both directions:
#
#   git commit -m "fix; ship it"     <- ';' is text, not a chain
#   echo hi && curl evil.example     <- '&&' is a chain
#
# So walk the string with a quote state machine, collapse every quoted span to a
# single Q, and keep only operators that are live at the shell level. What comes
# out is safe to grep. Command substitution markers survive precisely because
# they DO execute: $( and ` inside double quotes still run.
#
# An unterminated quote prints a trailing ';' so the caller treats the command
# as chained rather than as harmless text — the honest reading of input we
# cannot fully parse.

NR > 1 { line = line "\n" }
{ line = line $0 }

END {
  n = length(line)
  state = "bare"
  out = ""

  for (i = 1; i <= n; i++) {
    c = substr(line, i, 1)

    if (state == "bare") {
      if (c == "\\") { i++; out = out "Q"; continue }
      if (c == "'") { state = "single"; out = out "Q"; continue }
      if (c == "\"") { state = "double"; out = out "Q"; continue }
      out = out c
      continue
    }

    if (state == "single") {
      # Single quotes are literal all the way through. Nothing executes.
      if (c == "'") { state = "bare" }
      continue
    }

    # state == "double": text is inert, but substitutions are not.
    if (c == "\\") { i++; continue }
    if (c == "\"") { state = "bare"; continue }
    if (c == "`") { out = out "`"; continue }
    if (c == "$" && substr(line, i + 1, 1) == "(") { out = out "$("; i++; continue }
  }

  if (state != "bare") { out = out ";" }
  print out
}
