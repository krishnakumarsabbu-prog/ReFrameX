       IDENTIFICATION DIVISION.
       PROGRAM-ID. CLAIMCTL.
       AUTHOR. REFRAMEX-SAMPLE.

      * Sample COBOL program for ReframeX ingestion testing.
      * Represents a claims control module.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CLAIM-FILE  ASSIGN TO CLMFILE
               ORGANIZATION IS SEQUENTIAL.

       DATA DIVISION.
       FILE SECTION.
       FD  CLAIM-FILE
           RECORDING MODE IS F
           BLOCK CONTAINS 0 RECORDS
           RECORD CONTAINS 120 CHARACTERS.
       01  CLAIM-REC.
           05  CLM-ID          PIC 9(8).
           05  CLM-AMT         PIC 9(7)V99.
           05  CLM-DATE        PIC 9(8).
           05  CLM-STATUS      PIC X(2).
           05  CLM-DESC        PIC X(95).

       WORKING-STORAGE SECTION.
       01  WS-EOF              PIC X VALUE 'N'.
       01  WS-TOTAL            PIC 9(9)V99 VALUE ZERO.

       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT CLAIM-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ CLAIM-FILE
                   AT END
                       MOVE 'Y' TO WS-EOF
                   NOT AT END
                       ADD CLM-AMT TO WS-TOTAL
               END-READ
           END-PERFORM
           CLOSE CLAIM-FILE
           DISPLAY 'TOTAL CLAIMS: ' WS-TOTAL
           STOP RUN.
