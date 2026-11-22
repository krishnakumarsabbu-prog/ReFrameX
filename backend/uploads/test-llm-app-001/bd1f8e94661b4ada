       IDENTIFICATION DIVISION.
       PROGRAM-ID. CLAIMCTL.
       AUTHOR. REFRAMEX-ENTERPRISE.
      *----------------------------------------------------------------*
      * CLAIMS CONTROL & ADJUDICATION MAIN ENGINE                      *
      * Features: CICS, Embedded DB2 SQL, Dynamic CALL, GOTO logic     *
      *----------------------------------------------------------------*
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SPECIAL-NAMES.
           CICS SYSTEM-ID IS CLMSYS.

       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CLAIM-FILE ASSIGN TO CLMFILE
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS CLM-KEY.

       DATA DIVISION.
       FILE SECTION.
       FD  CLAIM-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 250 CHARACTERS.
       01  CLAIM-REC-FILE.
           05  CLM-KEY             PIC 9(10).
           05  CLM-DATA            PIC X(240).

       WORKING-STORAGE SECTION.
       01  WS-EOF                  PIC X VALUE 'N'.
       01  WS-PGM-NAME             PIC X(8) VALUE 'VALIDATE'.
       01  WS-TOTAL-AMT            PIC 9(9)V99 VALUE ZERO.
       01  WS-FRAUD-ALERT          PIC X VALUE 'N'.

      * Copybook for Insurance Policy details
       COPY POLICY.

      * Copybook for Claim Record Layout
       COPY CLAIMREC.

      * DB2 SQL Communication Area
       01  SQLCA.
           05  SQLCODE             PIC S9(9) COMP.
           05  SQLERRM             PIC X(70).

       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05  CA-CLAIM-ID         PIC 9(10).
           05  CA-POLICY-NUM       PIC X(12).
           05  CA-CLAIM-AMT        PIC 9(7)V99.
           05  CA-STATUS           PIC X(2).
           05  CA-ACTION-CODE      PIC X(4).

       PROCEDURE DIVISION USING DFHCOMMAREA.
       0000-MAIN-PROCESS.
           EVALUATE CA-ACTION-CODE
               WHEN 'ADJU'
                   PERFORM 1000-ADJUDICATE
               WHEN 'INQR'
                   PERFORM 2000-INQUIRY
               WHEN OTHER
                   GO TO 9999-ERROR-EXIT
           END-EVALUATE.

           EXEC CICS RETURN
               TRANSID('CLM1')
               COMMAREA(DFHCOMMAREA)
           END-EXEC.
           GOBACK.

       1000-ADJUDICATE.
      * Dynamic Call to Fraud Validation Routine
           MOVE 'VALIDATE' TO WS-PGM-NAME
           CALL WS-PGM-NAME USING DFHCOMMAREA, WS-FRAUD-ALERT.

           IF WS-FRAUD-ALERT = 'Y'
               MOVE 'FR' TO CA-STATUS
               GO TO 9999-ERROR-EXIT
           END-IF.

      * Embedded SQL to record approved claim
           EXEC SQL
               UPDATE CLAIMS.CLAIM_TRANS
               SET CLAIM_STATUS = 'AP',
                   CLAIM_AMT = :CA-CLAIM-AMT
               WHERE CLAIM_ID = :CA-CLAIM-ID
           END-EXEC.

           IF SQLCODE NOT = 0
               GO TO 9999-ERROR-EXIT
           END-IF.

           MOVE 'AP' TO CA-STATUS.

       2000-INQUIRY.
           EXEC CICS READ
               FILE('CLMFILE')
               INTO(CLAIM-REC)
               RIDFLD(CA-CLAIM-ID)
           END-EXEC.

       9999-ERROR-EXIT.
           MOVE 'ER' TO CA-STATUS.
           DISPLAY 'CLAIM PROCESSING ERROR ENCOUNTERED'.
           STOP RUN.
