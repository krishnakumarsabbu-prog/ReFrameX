       IDENTIFICATION DIVISION.
       PROGRAM-ID. ACCTLEDG.
       AUTHOR. SYNTHETIC-FIXTURE.

      * SYNTHETIC fixture — not a real Wells Fargo application.
      * Complex application: shared copybooks, dynamic CALL,
      * embedded SQL, CICS transactions, evidence gaps (missing copybook).

       ENVIRONMENT DIVISION.
       INPUT-CONTROL SECTION.
       CONFIGURATION SECTION.
       SPECIAL-NAMES.
           CICS SYSTEM-ID IS ACCTSYS.

       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT ACCT-FILE   ASSIGN TO ACCTFILE
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS ACCT-KEY.
           SELECT RPT-FILE    ASSIGN TO RPTFILE
               ORGANIZATION IS SEQUENTIAL.

       DATA DIVISION.
       FILE SECTION.
       FD  ACCT-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 200 CHARACTERS.
       01  ACCT-REC.
           05  ACCT-KEY       PIC 9(10).
           05  ACCT-BALANCE   PIC 9(11)V99.
           05  ACCT-STATUS    PIC X(2).
           05  ACCT-TYPE      PIC X(10).

       FD  RPT-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 132 CHARACTERS.
       01  RPT-REC            PIC X(132).

       WORKING-STORAGE SECTION.
       01  WS-EOF             PIC X VALUE 'N'.
       01  WS-TOTAL-BAL       PIC 9(13)V99 VALUE ZERO.
       01  WS-TRANS-COUNT     PIC 9(7) VALUE ZERO.
       01  WS-PGM-NAME        PIC X(8) VALUE SPACES.
       01  SQLCA.
           05  SQLCODE        PIC S9(9) COMP.
           05  SQLERRM        PIC X(70).
           05  SQLERRD        PIC S9(9) COMP OCCURS 6 TIMES.

      * Copy shared account layout
       COPY ACCTCOPY.

      * Copy transaction layout — THIS COPYBOOK IS MISSING (evidence gap)
       COPY TRANSCOPY.

       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05  CA-TRANS-ID    PIC X(4).
           05  CA-ACCT-NUM    PIC 9(10).
           05  CA-AMOUNT      PIC 9(9)V99.

       PROCEDURE DIVISION USING DFHCOMMAREA.
       MAIN-PARA.
           EVALUATE CA-TRANS-ID
               WHEN 'INQR'
                   PERFORM INQUIRY-PROCESS
               WHEN 'UPDT'
                   PERFORM UPDATE-PROCESS
               WHEN 'RPT '
                   PERFORM REPORT-PROCESS
               WHEN OTHER
                   PERFORM UNKNOWN-TRANS
           END-EVALUATE
           EXEC CICS RETURN
               TRANSID('ACCT')
               COMMAREA(DFHCOMMAREA)
           END-EXEC
           GOBACK.

       INQUIRY-PROCESS.
           EXEC CICS READ
               FILE('ACCTFILE')
               INTO(ACCT-REC)
               RIDFLD(CA-ACCT-NUM)
           END-EXEC
           MOVE ACCT-BALANCE TO CA-AMOUNT.

       UPDATE-PROCESS.
      * Dynamic call to validation subprogram
           MOVE 'VALIDATE' TO WS-PGM-NAME
           CALL WS-PGM-NAME USING DFHCOMMAREA
           EXEC SQL
               UPDATE ACCOUNT SET BALANCE = :CA-AMOUNT
               WHERE ACCT_NUM = :CA-ACCT-NUM
           END-EXEC
           ADD 1 TO WS-TRANS-COUNT.

       REPORT-PROCESS.
           OPEN OUTPUT RPT-FILE
           EXEC SQL
               SELECT ACCT_NUM, BALANCE INTO :ACCT-KEY, :ACCT-BALANCE
               FROM ACCOUNT WHERE STATUS = 'AC'
           END-EXEC
           PERFORM UNTIL SQLCODE NOT = 0
               WRITE RPT-REC FROM ACCT-REC
               EXEC SQL FETCH C1 INTO :ACCT-KEY, :ACCT-BALANCE END-EXEC
           END-PERFORM
           CLOSE RPT-FILE.

       UNKNOWN-TRANS.
           DISPLAY 'UNKNOWN TRANSACTION: ' CA-TRANS-ID.
