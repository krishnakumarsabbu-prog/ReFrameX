"""Unit tests for HLASM (High-Level Assembler) Full Extract Parser.

Verifies:
1. CSECT extraction (PROGRAM component)
2. START extraction (PROGRAM component)
3. RSECT extraction (PROGRAM component)
4. DSECT extraction (DATA_STRUCTURE component)
5. Multiple DSECTs within single module
6. ENTRY symbol export extraction (MODULE component)
7. EXTRN external symbol reference extraction (EXTERNAL_SYSTEM component)
8. WXTRN weak external symbol extraction
9. EQU symbolic equate extraction (MODULE component)
10. DC (Define Constant) extraction (DATA_STRUCTURE component)
11. DS (Define Storage) extraction (DATA_STRUCTURE component)
12. Static CALL target extraction
13. System macro extraction (WTO, WTOR, ABEND, GETMAIN, FREEMAIN)
14. CICS EXEC statement extraction in assembler
15. SQL EXEC statement extraction in assembler
16. Column 72 continuation handling
17. Comment handling (* and .* in column 1)
18. Parser capability and metadata attributes
"""

from __future__ import annotations

import pytest
from app.parsers.base import CapabilityLevel
from app.parsers.hlasm_parser import HlasmParser
from app.parsers.preprocessor import preprocess_text


@pytest.fixture
def parser():
    return HlasmParser()


def _parse_asm(parser: HlasmParser, text: str, filename: str = "TESTASM.asm"):
    lines = preprocess_text(text, language="asm")
    return parser._parse("art-asm-1", filename, lines, "HLASM")


def test_parser_metadata(parser):
    """Test 1: Parser metadata and capability level."""
    assert parser.name == "hlasm_full"
    assert parser.capability == CapabilityLevel.FULL_EXTRACT
    assert "HLASM" in parser.supported_categories
    assert "ASSEMBLER" in parser.supported_categories


def test_csect_extraction(parser):
    """Test 2: CSECT extracts as PROGRAM component."""
    code = """MYPROG   CSECT
         LR    12,15
         BR    14
         END   MYPROG
"""
    result = _parse_asm(parser, code)
    assert result.parse_status == "parsed"
    csects = [c for c in result.components if c.component_type == "PROGRAM"]
    assert len(csects) == 1
    assert csects[0].name == "MYPROG"
    assert csects[0].detected_properties.get("section_type") == "CSECT"


def test_start_extraction(parser):
    """Test 3: START extracts as PROGRAM component."""
    code = """MAINMOD  START 0
         USING *,12
         BR    14
         END
"""
    result = _parse_asm(parser, code)
    starts = [c for c in result.components if c.detected_properties.get("section_type") == "START"]
    assert len(starts) == 1
    assert starts[0].name == "MAINMOD"


def test_rsect_extraction(parser):
    """Test 4: RSECT (read-only CSECT) extraction."""
    code = """ROPROG   RSECT
         BR    14
         END
"""
    result = _parse_asm(parser, code)
    rsects = [c for c in result.components if c.detected_properties.get("section_type") == "RSECT"]
    assert len(rsects) == 1
    assert rsects[0].name == "ROPROG"


def test_dsect_extraction(parser):
    """Test 5: DSECT extracts as DATA_STRUCTURE component."""
    code = """CUSTREC  DSECT
CUSTID   DS    CL10
CUSTNAME DS    CL30
CUSTBAL  DS    PL6
"""
    result = _parse_asm(parser, code)
    dsects = [c for c in result.components if c.detected_properties.get("section_type") == "DSECT"]
    assert len(dsects) == 1
    assert dsects[0].name == "CUSTREC"
    assert dsects[0].component_type == "DATA_STRUCTURE"


def test_multiple_dsects(parser):
    """Test 6: Multiple DSECTs within a single module."""
    code = """HDRREC   DSECT
HDRLEN   DS    H
BODYREC  DSECT
BODYDAT  DS    CL100
"""
    result = _parse_asm(parser, code)
    dsects = [c for c in result.components if c.detected_properties.get("section_type") == "DSECT"]
    assert len(dsects) == 2
    names = {d.name for d in dsects}
    assert "HDRREC" in names
    assert "BODYREC" in names


def test_entry_symbol_export(parser):
    """Test 7: ENTRY statements export symbols."""
    code = """SUBMOD   CSECT
         ENTRY SUB1,SUB2
SUB1     LR    12,15
SUB2     BR    14
"""
    result = _parse_asm(parser, code)
    entries = [c for c in result.components if c.detected_properties.get("linkage") == "ENTRY"]
    assert len(entries) == 2
    names = {e.name for e in entries}
    assert "SUB1" in names
    assert "SUB2" in names


def test_extrn_external_symbols(parser):
    """Test 8: EXTRN statements import external symbols."""
    code = """MAINMOD  CSECT
         EXTRN LOGROUT,CALCVAL
         L     15,=V(LOGROUT)
"""
    result = _parse_asm(parser, code)
    extrns = [c for c in result.components if c.detected_properties.get("linkage") == "EXTRN"]
    assert len(extrns) == 2
    names = {e.name for e in extrns}
    assert "LOGROUT" in names
    assert "CALCVAL" in names
    assert all(e.component_type == "EXTERNAL_SYSTEM" for e in extrns)


def test_wxtrn_weak_external(parser):
    """Test 9: WXTRN statements import weak external symbols."""
    code = """MAINMOD  CSECT
         WXTRN OPTROUT
"""
    result = _parse_asm(parser, code)
    wxtrns = [c for c in result.components if c.detected_properties.get("linkage") == "WXTRN"]
    assert len(wxtrns) == 1
    assert wxtrns[0].name == "OPTROUT"


def test_equ_symbolic_equates(parser):
    """Test 10: EQU statements extracted as MODULE components."""
    code = """R12      EQU   12
R14      EQU   14
MAXLEN   EQU   256
"""
    result = _parse_asm(parser, code)
    equs = [c for c in result.components if "equ_name" in c.detected_properties]
    assert len(equs) == 3
    equ_map = {e.detected_properties["equ_name"]: e.detected_properties["equ_value"] for e in equs}
    assert equ_map["R12"] == "12"
    assert equ_map["MAXLEN"] == "256"


def test_dc_define_constant(parser):
    """Test 11: DC statements extracted as DATA_STRUCTURE components."""
    code = """TITLE    DC    C'ACCOUNT SUMMARY REPORT'
ZERO     DC    F'0'
MASK     DC    X'FFFF'
"""
    result = _parse_asm(parser, code)
    dcs = [c for c in result.components if c.detected_properties.get("data_op") == "DC"]
    assert len(dcs) == 3
    assert dcs[0].name == "TITLE"
    assert dcs[0].component_type == "DATA_STRUCTURE"


def test_ds_define_storage(parser):
    """Test 12: DS statements extracted as DATA_STRUCTURE components."""
    code = """BUFFER   DS    CL1024
SAVAREA  DS    18F
WORKNUM  DS    PL8
"""
    result = _parse_asm(parser, code)
    dss = [c for c in result.components if c.detected_properties.get("data_op") == "DS"]
    assert len(dss) == 3
    assert dss[0].name == "BUFFER"
    assert dss[0].component_type == "DATA_STRUCTURE"


def test_static_call_target(parser):
    """Test 13: CALL TARGET extracts as PROGRAM component with call properties."""
    code = """MAINMOD  CSECT
         CALL  SUBUTIL,(PARAM1,PARAM2),VL
         BR    14
"""
    result = _parse_asm(parser, code)
    calls = [c for c in result.components if c.detected_properties.get("call_type") == "static_asm_call"]
    assert len(calls) == 1
    assert calls[0].name == "SUBUTIL"
    assert calls[0].component_type == "PROGRAM"


def test_system_macros(parser):
    """Test 14: Standard IBM mainframe system macros."""
    code = """TESTMOD  CSECT
         WTO   'Processing started',ROUTCDE=(11)
         GETMAIN R,LV=4096
         FREEMAIN R,LV=4096,A=(1)
         ABEND 999,DUMP
"""
    result = _parse_asm(parser, code)
    macros = [c for c in result.components if "macro" in c.detected_properties]
    macro_names = {m.detected_properties["macro"] for m in macros}
    assert "WTO" in macro_names
    assert "GETMAIN" in macro_names
    assert "FREEMAIN" in macro_names
    assert "ABEND" in macro_names


def test_cics_command_in_assembler(parser):
    """Test 15: Embedded EXEC CICS command in assembler."""
    code = """CICSPROG CSECT
         EXEC  CICS SEND TEXT FROM(MSGTEXT) LENGTH(40)
         BR    14
"""
    result = _parse_asm(parser, code)
    cics = [c for c in result.components if c.detected_properties.get("macro_type") == "CICS"]
    assert len(cics) == 1
    assert cics[0].technology == "HLASM"


def test_sql_command_in_assembler(parser):
    """Test 16: Embedded EXEC SQL command in assembler."""
    code = """SQLPROG  CSECT
         EXEC  SQL SELECT ACCT_BAL INTO :BAL FROM ACCOUNTS WHERE ACCT_NO = :ACC
         BR    14
"""
    result = _parse_asm(parser, code)
    sqls = [c for c in result.components if c.detected_properties.get("macro_type") == "SQL"]
    assert len(sqls) == 1
    assert sqls[0].technology == "SQL"


def test_column_72_continuation(parser):
    """Test 17: Column 72 continuation handling in preprocessor."""
    # Line 1 has an 'X' in column 72 (index 71), continuing onto Line 2
    prefix = "LONGMAC  WTO   'This is a very long message string'"
    line1 = f"{prefix:<71}X"
    line2 = "               ROUTCDE=(1,11)"
    raw = f"{line1}\n{line2}\n"
    preprocessed = preprocess_text(raw, language="asm")
    assert len(preprocessed) == 2
    assert preprocessed[1].is_continuation is True
    assert preprocessed[1].area == "CONT"


def test_comments_handling(parser):
    """Test 18: Asterisk comments in col 1 and .* macro comments are ignored."""
    code = """* This is a full-line comment in column 1
.* This is a macro comment
MYPROG   CSECT
* Another comment inside the CSECT
         BR    14
"""
    result = _parse_asm(parser, code)
    # Only MYPROG CSECT should be returned
    assert len(result.components) == 1
    assert result.components[0].name == "MYPROG"
