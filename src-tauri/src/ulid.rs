//! Decodes a ULID's leading 10 chars (48-bit ms timestamp, Crockford base32)
//! into an epoch-ms number / ISO string. Port of server/src/ulid.ts.
//! https://github.com/ulid/spec

const CROCKFORD: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// Returns epoch milliseconds encoded in the ULID, or None if invalid.
pub fn ulid_timestamp_ms(ulid: &str) -> Option<u64> {
    if ulid.len() < 10 {
        return None;
    }
    let mut ms: u64 = 0;
    for ch in ulid[..10].chars() {
        let upper = ch.to_ascii_uppercase() as u8;
        let idx = CROCKFORD.iter().position(|&c| c == upper)?;
        ms = ms.checked_mul(32)?.checked_add(idx as u64)?;
    }
    Some(ms)
}

/// ISO-8601 UTC string (with milliseconds), matching JS `Date.toISOString()`.
pub fn ulid_timestamp_iso(ulid: &str) -> Option<String> {
    let ms = ulid_timestamp_ms(ulid)?;
    // Format as YYYY-MM-DDTHH:mm:ss.sssZ without external time crates.
    let secs = (ms / 1000) as i64;
    let millis = ms % 1000;
    let (year, month, day, hour, min, sec) = civil_from_days(secs);
    Some(format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}.{millis:03}Z"
    ))
}

/// Convert Unix seconds to UTC civil date/time (Howard Hinnant algorithm).
fn civil_from_days(unix_secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let day_secs = 86_400i64;
    let mut days = unix_secs.div_euclid(day_secs);
    let tod = unix_secs.rem_euclid(day_secs) as u32;
    let hour = tod / 3600;
    let min = (tod % 3600) / 60;
    let sec = tod % 60;

    // days since Unix epoch (1970-01-01) → civil year/month/day
    days += 719_468; // shift to civil algorithm epoch
    let era = if days >= 0 {
        days
    } else {
        days - 146_096
    } / 146_097;
    let doe = (days - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };

    (y as i32, m as u32, d as u32, hour, min, sec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ulid_spec_test_vector_matches_server_events_test() {
        // server/test/events.test.ts oracle — not the outdated comment in fixture.ts
        assert_eq!(
            ulid_timestamp_iso("01ARZ3NDEKTSV4RRFFQ69G5FAV").as_deref(),
            Some("2016-07-30T23:54:10.259Z")
        );
    }

    #[test]
    fn rejects_short_or_invalid() {
        assert_eq!(ulid_timestamp_ms(""), None);
        assert_eq!(ulid_timestamp_ms("short"), None);
        assert_eq!(ulid_timestamp_ms("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"), None);
    }
}
