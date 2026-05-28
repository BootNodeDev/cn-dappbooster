// Shortens non-party identifiers with the same compact shape used elsewhere in
// the counter UI when a value does not include a Canton party separator.
const shortIdentifier = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`

// Formats Canton party IDs by preserving the human-readable party name and
// shortening only the namespace fingerprint after the name::namespace separator.
export const formatPartyId = (partyId: string): string => {
  const separator = partyId.indexOf('::')
  if (separator === -1) {
    return shortIdentifier(partyId)
  }

  const name = partyId.slice(0, separator)
  const namespace = partyId.slice(separator + 2)
  const formattedNamespace =
    namespace.length <= 22 ? namespace : `${namespace.slice(0, 6)}...${namespace.slice(-8)}`

  return `${name}::${formattedNamespace}`
}
