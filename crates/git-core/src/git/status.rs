use super::text;
use crate::{ChangedFile, Status};

pub(crate) fn parse_status(bytes: &[u8]) -> Result<Status, String> {
    let mut status = Status::default();
    let mut records = bytes.split(|byte| *byte == 0);
    while let Some(record) = records.next() {
        match record.first() {
            Some(b'#') => parse_header(record, &mut status),
            Some(b'?' | b'1' | b'2' | b'u') => status.files.push(parse_file(record, &mut records)?),
            _ => {}
        }
    }
    Ok(status)
}

fn parse_header(record: &[u8], status: &mut Status) {
    let header = text(record);
    if let Some(value) = header.strip_prefix("# branch.head ") {
        if value != "(detached)" {
            status.branch = Some(value.into());
        }
    } else if let Some(value) = header.strip_prefix("# branch.oid ") {
        status.is_unborn = value == "(initial)";
    } else if let Some(value) = header.strip_prefix("# branch.upstream ") {
        status.upstream = Some(value.into());
    } else if let Some(value) = header.strip_prefix("# branch.ab ") {
        status.has_upstream_ref = true;
        if let Some((ahead, behind)) = value.split_once(' ') {
            status.ahead = ahead.trim_start_matches('+').parse().unwrap_or(0);
            status.behind = behind.trim_start_matches('-').parse().unwrap_or(0);
        }
    }
}

fn parse_file<'a>(
    record: &'a [u8],
    records: &mut impl Iterator<Item = &'a [u8]>,
) -> Result<ChangedFile, String> {
    let (path, original, state) = if record[0] == b'?' {
        (&record[2..], None, *b".?")
    } else {
        let field_count = match record[0] {
            b'1' => 9,
            b'2' => 10,
            _ => 11,
        };
        let mut fields = record.splitn(field_count, |byte| *byte == b' ');
        let state = fields.nth(1).ok_or("Invalid Git file status")?;
        let path = fields
            .nth(field_count - 3)
            .ok_or("Missing path in Git status")?;
        let original = (record[0] == b'2').then(|| records.next()).flatten();
        (
            path,
            original,
            <[u8; 2]>::try_from(state).map_err(|_| "Invalid Git file state")?,
        )
    };
    Ok(ChangedFile {
        id: path_id(path),
        path: text(path),
        original_path: original.map(text),
        original_id: original.map(path_id),
        staged: char::from(state[0]).to_string(),
        unstaged: char::from(state[1]).to_string(),
        has_conflict: record[0] == b'u',
    })
}

fn path_id(path: &[u8]) -> String {
    path.iter().map(|byte| format!("{byte:02x}")).collect()
}
