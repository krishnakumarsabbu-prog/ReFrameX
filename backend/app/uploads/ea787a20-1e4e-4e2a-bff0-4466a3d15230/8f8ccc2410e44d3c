       IDENTIFICATION DIVISION.
       PROGRAM-ID. VALIDATE.
       AUTHOR. REFRAMEX-SAMPLE.
      *----------------------------------------------------------------*
      * CLAIMS VALIDATION SUBROUTINE - DYNAMICALLY CALLED BY CLAIMCTL   *
      *----------------------------------------------------------------*
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-MAX-LIMIT        PIC 9(7)V99 VALUE 250000.00.

       LINKAGE SECTION.
       01  LNK-COMMAREA.
           05  LNK-CLAIM-ID    PIC 9(10).
           05  LNK-POLICY-NUM  PIC X(12).
           05  LNK-CLAIM-AMT   PIC 9(7)V99.
           05  LNK-STATUS      PIC X(2).
           05  LNK-ACTION      PIC X(4).
       01  LNK-FRAUD-ALERT     PIC X.

       PROCEDURE DIVISION USING LNK-COMMAREA, LNK-FRAUD-ALERT.
       VALIDATE-MAIN.
           IF LNK-CLAIM-AMT > WS-MAX-LIMIT
               MOVE 'Y' TO LNK-FRAUD-ALERT
           ELSE
               MOVE 'N' TO LNK-FRAUD-ALERT
           END-IF.
           GOBACK.
